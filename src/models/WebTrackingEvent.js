const mongoose = require("mongoose");

const webTrackingEventSchema = new mongoose.Schema(
    {
        appId: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        platform: {
            type: String,
            default: "web",
            enum: ["web"],
        },
        visitorId: {
            type: String,
            required: true,
            index: true,
        },
        sessionId: {
            type: String,
            required: true,
            index: true,
        },
        eventName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        pageUrl: {
            type: String,
            maxlength: 2048,
            default: "",
        },
        pageTitle: {
            type: String,
            maxlength: 300,
            default: "",
        },
        referrer: {
            type: String,
            maxlength: 2048,
            default: "",
        },
        source: {
            type: String,
            default: "direct",
            maxlength: 100,
        },
        device: {
            type: String,
            enum: ["mobile", "desktop", "tablet", "unknown"],
            default: "unknown",
        },
        browser: {
            type: String,
            default: "unknown",
            maxlength: 100,
        },
        country: { type: String, default: null },
        region: { type: String, default: null },
        city: { type: String, default: null },
        properties: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        durationMs: {
            type: Number,
            min: 0,
            default: null,
        },
        occurredAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    { timestamps: true },
);

webTrackingEventSchema.index({
    appId: 1,
    occurredAt: -1,
});

webTrackingEventSchema.index({
    appId: 1,
    eventName: 1,
    occurredAt: -1,
});

module.exports =
    mongoose.models.WebTrackingEvent ||
    mongoose.model("WebTrackingEvent", webTrackingEventSchema);
