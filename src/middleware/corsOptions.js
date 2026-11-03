function createCorsOptions({ nodeEnv, allowedOrigins }) {
    return {
        origin: (origin, callback) => {
            if (nodeEnv !== "production") {
                return callback(null, true);
            }

            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("CORS origin not allowed"));
        },
        credentials: false,
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Web-Tracking-Token",
        ],
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    };
}

module.exports = createCorsOptions;
