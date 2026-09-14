const Event = require("../models/Event");
const {getClientIp, hashIp, getLocation} = require("../utils/geo");

const getAllowedApps = () =>
    (process.env.APP_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const isValidApp = (appId) => getAllowedApps().includes(appId);

const getTodayStart = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const trackEvent = async (req, res) => {
    try {
        const {appId, deviceId, event, duration = 0, platform = "unknown"} = req.body;

        const ip = getClientIp(req);
        const location = getLocation(ip);

        const safeDuration = Math.min(Math.max(Number(duration) || 0, 0), 86400);

        const safePlatform = ["android", "ios", "unknown"].includes(platform) ? platform : "unknown";

        const newEvent = await Event.create({
            appId,
            deviceId,
            event,
            duration: safeDuration,
            platform: safePlatform,
            country: location.country,
            region: location.region,
            city: location.city,
            ipHash: hashIp(ip),
        });

        return res.status(201).json({
            success: true,
            message: "Event tracked",
            eventId: newEvent._id,
        });
    } catch (error) {
        console.error("Track error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to track event",
        });
    }
};

const getStats = async (req, res) => {
    try {
        const {appId} = req.query;
        const startOfToday = getTodayStart();

        if (appId && !isValidApp(appId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appId",
            });
        }

        const filter = {
            createdAt: {
                $gte: startOfToday,
            },
        };

        if (appId) {
            filter.appId = appId;
        }

        const [todayUsers, todaySessions, usageResult, countries, regions, platforms] = await Promise.all([
            Event.distinct("deviceId", filter),

            Event.countDocuments({
                ...filter,
                event: "session_start",
            }),

            Event.aggregate([
                {
                    $match: {
                        ...filter,
                        event: "session_end",
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalDuration: {
                            $sum: "$duration",
                        },
                        sessions: {
                            $sum: 1,
                        },
                    },
                },
            ]),

            Event.aggregate([
                {
                    $match: filter,
                },
                {
                    $group: {
                        _id: {
                            country: "$country",
                            deviceId: "$deviceId",
                        },
                    },
                },
                {
                    $group: {
                        _id: "$_id.country",
                        users: {
                            $sum: 1,
                        },
                    },
                },
                {
                    $sort: {
                        users: -1,
                    },
                },
                {
                    $limit: 20,
                },
            ]),

            Event.aggregate([
                {
                    $match: filter,
                },
                {
                    $group: {
                        _id: {
                            country: "$country",
                            region: "$region",
                            deviceId: "$deviceId",
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            country: "$_id.country",
                            region: "$_id.region",
                        },
                        users: {
                            $sum: 1,
                        },
                    },
                },
                {
                    $sort: {
                        users: -1,
                    },
                },
                {
                    $limit: 50,
                },
            ]),

            Event.aggregate([
                {
                    $match: filter,
                },
                {
                    $group: {
                        _id: {
                            platform: "$platform",
                            deviceId: "$deviceId",
                        },
                    },
                },
                {
                    $group: {
                        _id: "$_id.platform",
                        users: {
                            $sum: 1,
                        },
                    },
                },
                {
                    $sort: {
                        users: -1,
                    },
                },
            ]),
        ]);

        const totalDuration = usageResult[0]?.totalDuration || 0;

        const usageSessions = usageResult[0]?.sessions || 0;

        const averageSessionMinutes = usageSessions > 0 ? Number((totalDuration / usageSessions / 60).toFixed(2)) : 0;

        const apps = await Event.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startOfToday,
                    },
                    ...(appId ? {appId} : {}),
                },
            },
            {
                $group: {
                    _id: {
                        appId: "$appId",
                        deviceId: "$deviceId",
                    },
                },
            },
            {
                $group: {
                    _id: "$_id.appId",
                    users: {
                        $sum: 1,
                    },
                },
            },
            {
                $sort: {
                    users: -1,
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            date: startOfToday.toISOString().split("T")[0],
            appId: appId || "all",
            today: {
                uniqueUsers: todayUsers.length,
                sessions: todaySessions,
                totalUsageMinutes: Math.round(totalDuration / 60),
                averageSessionMinutes,
            },
            apps,
            countries,
            regions,
            platforms,
        });
    } catch (error) {
        console.error("Stats error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get statistics",
        });
    }
};

const getDailyStats = async (req, res) => {
    try {
        const days = Math.min(Math.max(Number.parseInt(req.query.days || "7", 10), 1), 90);

        const {appId} = req.query;

        if (appId && !isValidApp(appId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appId",
            });
        }

        const start = getTodayStart();

        start.setDate(start.getDate() - (days - 1));

        const match = {
            createdAt: {
                $gte: start,
            },
            ...(appId ? {appId} : {}),
        };

        const data = await Event.aggregate([
            {
                $match: match,
            },
            {
                $group: {
                    _id: {
                        year: {
                            $year: "$createdAt",
                        },
                        month: {
                            $month: "$createdAt",
                        },
                        day: {
                            $dayOfMonth: "$createdAt",
                        },
                        deviceId: "$deviceId",
                    },
                },
            },
            {
                $group: {
                    _id: {
                        year: "$_id.year",
                        month: "$_id.month",
                        day: "$_id.day",
                    },
                    users: {
                        $sum: 1,
                    },
                },
            },
            {
                $sort: {
                    "_id.year": 1,
                    "_id.month": 1,
                    "_id.day": 1,
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            days,
            appId: appId || "all",
            data,
        });
    } catch (error) {
        console.error("Daily stats error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get daily statistics",
        });
    }
};

const getLocations = async (req, res) => {
    try {
        const {appId} = req.query;

        if (appId && !isValidApp(appId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appId",
            });
        }

        const match = appId ? {appId} : {};

        const locations = await Event.aggregate([
            {
                $match: match,
            },
            {
                $group: {
                    _id: {
                        country: "$country",
                        region: "$region",
                        city: "$city",
                    },
                    users: {
                        $addToSet: "$deviceId",
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    country: "$_id.country",
                    region: "$_id.region",
                    city: "$_id.city",
                    users: {
                        $size: "$users",
                    },
                },
            },
            {
                $sort: {
                    users: -1,
                },
            },
            {
                $limit: 100,
            },
        ]);

        return res.status(200).json({
            success: true,
            appId: appId || "all",
            locations,
        });
    } catch (error) {
        console.error("Locations error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get locations",
        });
    }
};

module.exports = {
    trackEvent,
    getStats,
    getDailyStats,
    getLocations,
};
