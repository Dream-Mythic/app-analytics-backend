const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.3",

        info: {
            title: "Mobile Apps Analytics API",
            version: "1.0.0",
            description: "Analytics API for mobile applications",
        },

        tags: [
            {
                name: "Analytics",
                description: "Application analytics endpoints",
            },
        ],
    },

    apis: [path.join(__dirname, "routes/*.js")],
});

module.exports = swaggerSpec;
