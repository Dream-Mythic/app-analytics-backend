
const mongoose = require("mongoose");

const webTrackingSessionSchema = new mongoose.Schema(
    {
        appId: {
            type: String,
            required: true,
            index: true,
        },
        visitorId: {
            type: String,
            required: true,
            index: true,
        },
        sessionId: {
            type: String,
            required: true,
            unique: true,
        },
        platform: {
            type: String,
            default: "web",
        },
        currentPage: {
            type: String,
            default: "",
        },
        referrer: {
            type: String,
            default: "",
        },
        source: {
            type: String,
            default: "direct",
        },
        device: {
            type: String,
            default: "unknown",
        },
        browser: {
            type: String,
            default: "unknown",
        },
        country: { type: String, default: null },
        region: { type: String, default: null },
        city: { type: String, default: null },
        startedAt: {
            type: Date,
            default: Date.now,
        },
        lastSeenAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        endedAt: {
            type: Date,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        pageViews: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

webTrackingSessionSchema.index({
    appId: 1,
    isActive: 1,
    lastSeenAt: -1,
});

webTrackingSessionSchema.index({
    appId: 1,
    visitorId: 1,
    startedAt: -1,
});

module.exports =
    mongoose.models.WebTrackingSession ||
    mongoose.model("WebTrackingSession", webTrackingSessionSchema);
