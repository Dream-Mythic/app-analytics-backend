require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");

const connectDB = require("./config/db");
const swaggerSpec = require("./swagger");
const analyticsRoutes = require("./routes/analytics");

const app = express();

const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

app.set("trust proxy", 1);

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: false,
    })
);

const allowedOrigins = (process.env.CORS_ORIGINS || "")
.split(",")
.map((origin) => origin.trim())
.filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (NODE_ENV !== "production") {
                return callback(null, true);
            }

            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("CORS origin not allowed"));
        },
        credentials: false,
    })
);

app.use(
    express.json({
        limit: "100kb",
    })
);

app.use(
    "/api",
    rateLimit({
        windowMs: 60 * 1000,
        limit: 300,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: {
            success: false,
            message: "Too many requests. Try again later.",
        },
    })
);

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        status: "OK",
        service: "Mobile Apps Analytics API",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api", analyticsRoutes);

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customSiteTitle: "Mobile Apps Analytics API",
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
        },
    })
);

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        name: "Mobile Apps Analytics API",
        version: "1.0.0",
        endpoints: {
            health: "/api/health",
            track: "POST /api/track",
            stats: "GET /api/stats",
            dailyStats: "GET /api/stats/daily",
            locations: "GET /api/stats/locations",
            swagger: "/api-docs",
        },
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
    });
});

app.use((err, req, res, next) => {
    console.error(err);

    if (err.message === "CORS origin not allowed") {
        return res.status(403).json({
            success: false,
            message: "CORS origin not allowed",
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: NODE_ENV === "production" ? "Internal server error" : err.message,
    });
});

async function startServer() {
    try {
        await connectDB();

        const server = app.listen(PORT, () => {
            console.log(`Environment: ${NODE_ENV}`);
            console.log(`Server running: ${API_BASE_URL}`);
            console.log(`Swagger UI: ${API_BASE_URL}/api-docs/`);
        });

        const shutdown = async (signal) => {
            console.log(`${signal} received. Shutting down...`);

            server.close(async () => {
                try {
                    const mongoose = require("mongoose");

                    await mongoose.connection.close();

                    console.log("MongoDB connection closed");
                    process.exit(0);
                } catch (error) {
                    console.error("Shutdown error:", error.message);

                    process.exit(1);
                }
            });
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    } catch (error) {
        console.error("Server startup failed:", error.message);

        process.exit(1);
    }
}

process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection:", error);
    process.exit(1);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    process.exit(1);
});

startServer();
