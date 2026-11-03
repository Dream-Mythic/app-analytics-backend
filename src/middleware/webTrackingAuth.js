
const crypto = require("node:crypto");

const TOKEN_PATTERN = /^\d{40}$/;

function validateWebTrackingToken(token) {
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
        console.error(
            "[WebTrackingAuth] Invalid WEB_TRACKING_TOKEN configuration"
        );

        throw new Error(
            "WEB_TRACKING_TOKEN must be configured as exactly 40 numeric digits."
        );
    }

    return token;
}

function createWebTrackingAuthMiddleware(
    getConfiguredToken = () => process.env.WEB_TRACKING_TOKEN
) {
    return (req, res, next) => {
        console.log("\n========== Web Tracking Auth ==========");
        console.log("[WebTrackingAuth] Request received");
        console.log("[WebTrackingAuth] Method:", req.method);
        console.log("[WebTrackingAuth] Path:", req.originalUrl);

        // 1. Read environment token
        const rawConfiguredToken = getConfiguredToken();

        console.log(
            "[WebTrackingAuth] ENV token type:",
            typeof rawConfiguredToken
        );

        console.log(
            "[WebTrackingAuth] ENV token value:",
            rawConfiguredToken
        );

        console.log(
            "[WebTrackingAuth] ENV token length:",
            typeof rawConfiguredToken === "string"
                ? rawConfiguredToken.length
                : 0
        );

        let configuredToken;

        try {
            configuredToken = validateWebTrackingToken(
                rawConfiguredToken
            );

            console.log(
                "[WebTrackingAuth] ENV token validation: PASSED"
            );
        } catch (error) {
            console.error(
                "[WebTrackingAuth] Configuration error:",
                error.message
            );

            return res.status(503).json({
                success: false,
                message: "Web tracking authentication is unavailable.",
            });
        }

        // 2. Read incoming request token
        const incomingToken = req.get("X-Web-Tracking-Token");

        console.log(
            "[WebTrackingAuth] Incoming token type:",
            typeof incomingToken
        );

        console.log(
            "[WebTrackingAuth] Incoming token value:",
            incomingToken
        );

        console.log(
            "[WebTrackingAuth] Incoming token length:",
            typeof incomingToken === "string"
                ? incomingToken.length
                : 0
        );

        if (typeof incomingToken !== "string") {
            console.warn(
                "[WebTrackingAuth] Token header missing"
            );

            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        // 3. Compare tokens
        const expected = Buffer.from(configuredToken, "utf8");
        const received = Buffer.from(incomingToken, "utf8");

        console.log(
            "[WebTrackingAuth] ENV buffer type:",
            expected.constructor.name
        );

        console.log(
            "[WebTrackingAuth] Incoming buffer type:",
            received.constructor.name
        );

        console.log(
            "[WebTrackingAuth] ENV buffer length:",
            expected.length
        );

        console.log(
            "[WebTrackingAuth] Incoming buffer length:",
            received.length
        );

        const tokensMatch =
            expected.length === received.length &&
            crypto.timingSafeEqual(expected, received);

        console.log(
            "[WebTrackingAuth] Tokens match:",
            tokensMatch
        );

        if (!tokensMatch) {
            console.warn(
                "[WebTrackingAuth] Authentication FAILED: Token mismatch"
            );

            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        console.log(
            "[WebTrackingAuth] Authentication SUCCESSFUL"
        );
        console.log("========================================\n");

        return next();
    };
}

module.exports = {
    createWebTrackingAuthMiddleware,
    validateWebTrackingToken,
};
