const AiLog = require("../models/AiLog");

const createAiLog = async (req, res) => {
    try {
        const {
            service = "ai",
            provider,
            model,
            status,
            statusCode,
            errorCode = null,
            errorKind = null,
            durationMs,
            timestamp,
        } = req.body || {};

        if (
            service !== "ai" ||
            typeof provider !== "string" ||
            !provider.trim() ||
            provider.length > 100 ||
            typeof model !== "string" ||
            !model.trim() ||
            model.length > 200 ||
            !["success", "error"].includes(status) ||
            !Number.isInteger(statusCode) ||
            statusCode < 100 ||
            statusCode > 599 ||
            !Number.isFinite(durationMs) ||
            durationMs < 0 ||
            durationMs > 86400000 ||
            (errorCode !== null && (typeof errorCode !== "string" || errorCode.length > 100)) ||
            (errorKind !== null && (typeof errorKind !== "string" || errorKind.length > 100))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid AI log payload",
            });
        }

        const logTimestamp = timestamp === undefined ? new Date() : new Date(timestamp);

        if (Number.isNaN(logTimestamp.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid timestamp",
            });
        }

        const log = await AiLog.create({
            service,
            provider: provider.trim(),
            model: model.trim(),
            status,
            statusCode,
            errorCode,
            errorKind,
            durationMs,
            timestamp: logTimestamp,
        });

        return res.status(201).json({
            success: true,
            message: "AI log saved successfully",
            data: log,
        });
    } catch (error) {
        console.error("Create AI log error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to save AI log",
        });
    }
};

const getAiLogs = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

        const filter = {};

        if (req.query.status !== undefined) {
            if (!["success", "error"].includes(req.query.status)) {
                return res.status(400).json({
                    success: false,
                    message: "status must be success or error",
                });
            }

            filter.status = req.query.status;
        }

        if (req.query.model !== undefined) {
            const model = String(req.query.model).trim();

            if (!model || model.length > 200) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid model filter",
                });
            }

            filter.model = model;
        }

        if (req.query.provider !== undefined) {
            filter.provider = String(req.query.provider).trim();
        }

        const [logs, total] = await Promise.all([
            AiLog.find(filter)
            .sort({timestamp: -1})
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
            AiLog.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get AI logs error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve AI logs",
        });
    }
};

module.exports = {
    createAiLog,
    getAiLogs,
};
