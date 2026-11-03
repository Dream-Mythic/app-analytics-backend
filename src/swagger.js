
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.3",

        info: {
            title: "Mobile Apps & Web Tracking API",
            version: "1.1.0",
            description:
                "Analytics API for mobile applications and public web applications",
        },

        tags: [
            {
                name: "Analytics",
                description: "Existing mobile application analytics endpoints",
            },
            {
                name: "Web Tracking",
                description:
                    "Web visitor tracking, sessions, real-time analytics and reports",
            },
        ],

        components: {
            securitySchemes: {
                WebTrackingToken: {
                    type: "apiKey",
                    in: "header",
                    name: "X-Web-Tracking-Token",
                    description:
                        "40-digit web tracking shared token. It is not suitable for protecting administrative analytics.",
                },
            },
            schemas: {
                WebTrackingEventInput: {
                    type: "object",
                    required: [
                        "appId",
                        "visitorId",
                        "sessionId",
                        "eventName",
                    ],
                    properties: {
                        appId: {
                            type: "string",
                            example: "web_app_1",
                            description: "Unique identifier for the web application",
                        },
                        visitorId: {
                            type: "string",
                            example: "visitor_123",
                        },
                        sessionId: {
                            type: "string",
                            example: "session_456",
                        },
                        eventName: {
                            type: "string",
                            example: "page_view",
                            enum: [
                                "page_view",
                                "click",
                                "search",
                                "signup",
                                "login",
                                "purchase",
                                "conversion",
                                "form_start",
                                "form_submit",
                                "scroll",
                                "custom",
                                "performance",
                                "error",
                            ],
                        },
                        pageUrl: {
                            type: "string",
                            example: "https://example.com/pricing",
                        },
                        pageTitle: {
                            type: "string",
                            example: "Pricing",
                        },
                        referrer: {
                            type: "string",
                            example: "https://google.com/",
                        },
                        source: {
                            type: "string",
                            example: "google",
                        },
                        device: {
                            type: "string",
                            enum: ["mobile", "desktop", "tablet", "unknown"],
                            example: "desktop",
                        },
                        browser: {
                            type: "string",
                            example: "Chrome",
                        },
                        country: {
                            type: "string",
                            nullable: true,
                            example: "India",
                        },
                        region: {
                            type: "string",
                            nullable: true,
                            example: "Maharashtra",
                        },
                        city: {
                            type: "string",
                            nullable: true,
                            example: "Pune",
                        },
                        durationMs: {
                            type: "number",
                            minimum: 0,
                            example: 1250,
                        },
                        properties: {
                            type: "object",
                            additionalProperties: true,
                            example: {
                                buttonId: "get-started",
                                category: "navigation",
                            },
                        },
                    },
                },

                WebTrackingBatchInput: {
                    type: "object",
                    required: ["events"],
                    properties: {
                        events: {
                            type: "array",
                            minItems: 1,
                            maxItems: 100,
                            items: {
                                $ref: "#/components/schemas/WebTrackingEventInput",
                            },
                        },
                    },
                },

                WebTrackingSessionInput: {
                    type: "object",
                    required: ["appId", "visitorId", "sessionId"],
                    properties: {
                        appId: {
                            type: "string",
                            example: "web_app_1",
                        },
                        visitorId: {
                            type: "string",
                            example: "visitor_123",
                        },
                        sessionId: {
                            type: "string",
                            example: "session_456",
                        },
                        pageUrl: {
                            type: "string",
                            example: "https://example.com/",
                        },
                        referrer: {
                            type: "string",
                            example: "https://google.com/",
                        },
                        source: {
                            type: "string",
                            example: "direct",
                        },
                        device: {
                            type: "string",
                            enum: ["mobile", "desktop", "tablet", "unknown"],
                        },
                        browser: {
                            type: "string",
                            example: "Chrome",
                        },
                    },
                },

                WebTrackingHeartbeatInput: {
                    type: "object",
                    required: ["appId", "sessionId"],
                    properties: {
                        appId: {
                            type: "string",
                            example: "web_app_1",
                        },
                        sessionId: {
                            type: "string",
                            example: "session_456",
                        },
                        pageUrl: {
                            type: "string",
                            example: "https://example.com/features",
                        },
                    },
                },

                WebTrackingSessionEndInput: {
                    type: "object",
                    required: ["appId", "sessionId"],
                    properties: {
                        appId: {
                            type: "string",
                            example: "web_app_1",
                        },
                        sessionId: {
                            type: "string",
                            example: "session_456",
                        },
                    },
                },

                WebTrackingSuccessResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                    },
                },

                WebTrackingErrorResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: false,
                        },
                        message: {
                            type: "string",
                            example: "Invalid event data",
                        },
                    },
                },
            },
        },
    },

    apis: [path.join(__dirname, "routes/*.js")],
});

module.exports = swaggerSpec;
