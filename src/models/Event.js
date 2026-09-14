const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        appId: {
            type: String,
            required: true,
            index: true
        },

        deviceId: {
            type: String,
            required: true,
            index: true
        },

        event: {
            type: String,
            required: true,
            enum: [
                "app_open",
                "session_start",
                "session_end",
                "app_close"
            ],
            index: true
        },

        duration: {
            type: Number,
            default: 0,
            min: 0
        },

        platform: {
            type: String,
            enum: ["android", "ios", "unknown"],
            default: "unknown"
        },

        country: {
            type: String,
            default: "Unknown",
            index: true
        },

        region: {
            type: String,
            default: "Unknown",
            index: true
        },

        city: {
            type: String,
            default: "Unknown"
        },

        ipHash: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

eventSchema.index({ appId: 1, createdAt: -1 });
eventSchema.index({ deviceId: 1, createdAt: -1 });
eventSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("Event", eventSchema);