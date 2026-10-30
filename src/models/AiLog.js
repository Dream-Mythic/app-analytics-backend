const mongoose = require("mongoose");

const aiLogSchema = new mongoose.Schema(
    {
        service: {
            type: String,
            default: "ai",
            required: true,
        },
        provider: {
            type: String,
            required: true,
            trim: true,
        },
        model: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["success", "error"],
            required: true,
            index: true,
        },
        statusCode: {
            type: Number,
            required: true,
        },
        errorCode: {
            type: String,
            default: null,
        },
        errorKind: {
            type: String,
            default: null,
        },
        durationMs: {
            type: Number,
            required: true,
            min: 0,
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

aiLogSchema.index({model: 1, timestamp: -1});
aiLogSchema.index({status: 1, timestamp: -1});

module.exports = mongoose.models.AiLog || mongoose.model("AiLog", aiLogSchema);
