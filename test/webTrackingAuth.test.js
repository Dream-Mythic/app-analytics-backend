const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");

const TOKEN = "1234567890123456789012345678901234567890";
process.env.WEB_TRACKING_TOKEN = TOKEN;

const {
    createWebTrackingAuthMiddleware,
    validateWebTrackingToken,
} = require("../src/middleware/webTrackingAuth");
const createCorsOptions = require("../src/middleware/corsOptions");
const trackingRoutes = require("../src/routes/webTracking");
const swaggerSpec = require("../src/swagger");

const postPaths = [
    "/collect",
    "/batch",
    "/session/start",
    "/session/heartbeat",
    "/session/end",
];
const getPaths = [
    "/realtime",
    "/overview",
    "/pages",
    "/events",
    "/sources",
    "/devices",
    "/locations",
    "/funnels",
    "/performance",
];

const app = express();
const jsonParser = express.json();
app.use((req, res, next) =>
    req.path.startsWith("/api/web-tracking")
        ? next()
        : jsonParser(req, res, next),
);
app.use("/api/web-tracking", trackingRoutes);
app.get("/api/health", (_req, res) => res.status(200).json({ status: "OK" }));
app.use((error, _req, res, _next) =>
    res.status(error.status || 500).json({ message: error.message }),
);

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
        );
    }
});

test("validates backend token configuration without exposing its value", () => {
    assert.equal(validateWebTrackingToken(TOKEN), TOKEN);
    for (const invalid of [undefined, "", "1".repeat(39), "1".repeat(41), "x".repeat(40)]) {
        assert.throws(() => validateWebTrackingToken(invalid), {
            message:
                "WEB_TRACKING_TOKEN must be configured as exactly 40 numeric digits.",
        });
    }
});

test("constant-time comparison is performed for same-length token candidates", async () => {
    const original = crypto.timingSafeEqual;
    let comparisonUsed = false;
    crypto.timingSafeEqual = (...args) => {
        comparisonUsed = true;
        return original(...args);
    };
    try {
        const middleware = createWebTrackingAuthMiddleware(() => TOKEN);
        const authApp = express();
        authApp.get("/protected", middleware, (_req, res) => res.sendStatus(204));
        const authServer = authApp.listen(0);
        await new Promise((resolve) => authServer.once("listening", resolve));
        try {
            const response = await fetch(
                `http://127.0.0.1:${authServer.address().port}/protected`,
                { headers: { "X-Web-Tracking-Token": "9".repeat(40) } },
            );
            assert.equal(response.status, 401);
            assert.equal(comparisonUsed, true);
        } finally {
            await new Promise((resolve, reject) =>
                authServer.close((error) => (error ? reject(error) : resolve())),
            );
        }
    } finally {
        crypto.timingSafeEqual = original;
    }
});

test("all five tracking POST routes reject missing and incorrect tokens", async (t) => {
    for (const path of postPaths) {
        await t.test(path, async () => {
            const noToken = await fetch(`${baseUrl}/api/web-tracking${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });
            assert.equal(noToken.status, 401);
            const malformedBody = await fetch(
                `${baseUrl}/api/web-tracking${path}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{invalid-json",
                },
            );
            assert.equal(malformedBody.status, 401);
            const wrongToken = await fetch(`${baseUrl}/api/web-tracking${path}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Web-Tracking-Token": "9".repeat(40),
                },
                body: "{}",
            });
            assert.equal(wrongToken.status, 401);
        });
    }
});

test("all nine analytics GET routes reject missing and incorrect tokens", async (t) => {
    for (const path of getPaths) {
        await t.test(path, async () => {
            const noToken = await fetch(
                `${baseUrl}/api/web-tracking${path}?appId=sample`,
            );
            assert.equal(noToken.status, 401);
            const wrongToken = await fetch(
                `${baseUrl}/api/web-tracking${path}?appId=sample`,
                { headers: { "X-Web-Tracking-Token": "9".repeat(40) } },
            );
            assert.equal(wrongToken.status, 401);
        });
    }
});

test("the API schema marks all fourteen web tracking routes as token-protected", () => {
    for (const [method, paths] of [
        ["post", postPaths],
        ["get", getPaths],
    ]) {
        for (const path of paths) {
            const operation =
                swaggerSpec.paths[`/api/web-tracking${path}`]?.[method];
            assert.deepEqual(operation?.security, [{ WebTrackingToken: [] }]);
        }
    }
});

test("correct token continues to route validation and validation stays 400", async () => {
    const response = await fetch(`${baseUrl}/api/web-tracking/collect`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Web-Tracking-Token": TOKEN,
        },
        body: JSON.stringify({ eventName: "not-an-event" }),
    });
    assert.equal(response.status, 400);
});

test("an invalid configured token fails closed", async () => {
    const authApp = express();
    authApp.get(
        "/protected",
        createWebTrackingAuthMiddleware(() => "invalid"),
        (_req, res) => res.sendStatus(204),
    );
    const authServer = authApp.listen(0);
    await new Promise((resolve) => authServer.once("listening", resolve));
    try {
        const response = await fetch(
            `http://127.0.0.1:${authServer.address().port}/protected`,
            { headers: { "X-Web-Tracking-Token": TOKEN } },
        );
        assert.equal(response.status, 503);
    } finally {
        await new Promise((resolve, reject) =>
            authServer.close((error) => (error ? reject(error) : resolve())),
        );
    }
});

test("CORS allows the token header for approved origins only", async () => {
    const options = createCorsOptions({
        nodeEnv: "production",
        allowedOrigins: ["https://approved.example"],
    });
    await new Promise((resolve, reject) =>
        options.origin("https://approved.example", (error, allowed) =>
            error || !allowed
                ? reject(error || new Error("Approved origin rejected"))
                : resolve(),
        ),
    );
    await new Promise((resolve) =>
        options.origin("https://unapproved.example", (error) =>
            resolve(error),
        ),
    ).then((error) => assert.equal(error.message, "CORS origin not allowed"));

    const corsApp = express();
    corsApp.use(cors(options));
    corsApp.post("/preflight", (_req, res) => res.sendStatus(204));
    const corsServer = corsApp.listen(0);
    await new Promise((resolve) => corsServer.once("listening", resolve));
    try {
        const response = await fetch(
            `http://127.0.0.1:${corsServer.address().port}/preflight`,
            {
                method: "OPTIONS",
                headers: {
                    Origin: "https://approved.example",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers":
                        "content-type,x-web-tracking-token",
                },
            },
        );
        assert.equal(response.status, 204);
        assert.match(
            response.headers.get("access-control-allow-headers"),
            /x-web-tracking-token/i,
        );
        assert.match(
            response.headers.get("access-control-allow-methods"),
            /POST/i,
        );
    } finally {
        await new Promise((resolve, reject) =>
            corsServer.close((error) => (error ? reject(error) : resolve())),
        );
    }
});

test("unrelated application routes remain outside tracking authentication", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
});
