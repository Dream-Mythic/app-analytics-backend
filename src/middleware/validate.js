const allowedEvents = ["app_open", "session_start", "session_end", "app_close"];

function validateTrack(req, res, next) {
    const {appId, deviceId, event} = req.body;

    if (!appId) {
        return res.status(400).json({
            success: false,
            message: "appId is required",
        });
    }

    if (!process.env.APP_IDS.split(",").includes(appId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid appId",
        });
    }

    if (!deviceId) {
        return res.status(400).json({
            success: false,
            message: "deviceId is required",
        });
    }

    if (typeof deviceId !== "string" || deviceId.length > 200) {
        return res.status(400).json({
            success: false,
            message: "Invalid deviceId",
        });
    }

    if (!event || !allowedEvents.includes(event)) {
        return res.status(400).json({
            success: false,
            message: "Invalid event",
        });
    }

    next();
}

module.exports = {
    validateTrack,
};
