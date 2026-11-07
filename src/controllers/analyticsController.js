const Event = require("../models/Event");
const {getClientIp, hashIp, getLocation} = require("../utils/geo");

const getAllowedApps = () =>
    (process.env.APP_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const isValidApp = (appId) => getAllowedApps().includes(appId);

const getTodayStart = () => {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
        const {date} = req.query;
        let {appId} = req.query;

        if (appId === "all") {
            appId = undefined;
        }

        if (appId && !isValidApp(appId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appId",
            });
        }

        const now = new Date();

        const selectedDate =
            date ||
            new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().split("T")[0];

        // Validate YYYY-MM-DD format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date. Use YYYY-MM-DD",
            });
        }

        // Validate that the date actually exists
        const parsedDate = new Date(`${selectedDate}T00:00:00.000Z`);

        if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== selectedDate) {
            return res.status(400).json({
                success: false,
                message: "Invalid date",
            });
        }

        // Selected date boundaries in UTC
        const startOfDay = new Date(
            Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate())
        );

        const endOfDay = new Date(
            Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate() + 1)
        );

        const filter = {
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            ...(appId ? {appId} : {}),
        };

        /*
         * Get all unique devices for today.
         * For each device, keep only its latest event.
         */
        const uniqueDevicesPipeline = [
            {
                $match: filter,
            },
            {
                $sort: {
                    deviceId: 1,
                    createdAt: -1,
                },
            },
            {
                $group: {
                    _id: "$deviceId",
                    appId: {
                        $first: "$appId",
                    },
                    country: {
                        $first: "$country",
                    },
                    region: {
                        $first: "$region",
                    },
                    city: {
                        $first: "$city",
                    },
                    platform: {
                        $first: "$platform",
                    },
                },
            },
        ];

        const [uniqueDevices, todaySessions, usageResult, countries, regions, platforms, apps] = await Promise.all([
            /*
             * Unique users
             */
            Event.aggregate(uniqueDevicesPipeline),

            /*
             * Total sessions started today
             */
            Event.countDocuments({
                ...filter,
                event: "session_start",
            }),

            /*
             * Usage duration
             */
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

            /*
             * Countries
             *
             * One device can only belong to one country.
             */
            Event.aggregate([
                ...uniqueDevicesPipeline,
                {
                    $group: {
                        _id: "$country",
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

            /*
             * Regions / Cities
             *
             * One device can only belong to one location.
             */
            Event.aggregate([
                ...uniqueDevicesPipeline,
                {
                    $group: {
                        _id: {
                            country: "$country",
                            region: "$region",
                            city: "$city",
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

            /*
             * Platforms
             *
             * One device can only belong to one platform.
             */
            Event.aggregate([
                ...uniqueDevicesPipeline,
                {
                    $group: {
                        _id: "$platform",
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

            /*
             * Apps
             *
             * One device counted only once.
             */
            Event.aggregate([
                ...uniqueDevicesPipeline,
                {
                    $group: {
                        _id: "$appId",
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

        return res.status(200).json({
            success: true,
            date: selectedDate,
            appId: appId || "all",

            today: {
                uniqueUsers: uniqueDevices.length,
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

        let {appId} = req.query;

        if (appId === "all") {
            appId = undefined;
        }

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
        let {appId} = req.query;

        if (appId === "all") {
            appId = undefined;
        }

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

const getDailyUserStats = async (req, res) => {
    try {
        let {appId = "all", date} = req.query;

        if (appId !== "all" && !isValidApp(appId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appId",
            });
        }

        // Validate date (YYYY-MM-DD)
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: "Valid date is required (YYYY-MM-DD)",
            });
        }

        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);

        // Validate actual calendar date
        if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) {
            return res.status(400).json({
                success: false,
                message: "Invalid date",
            });
        }

        const match = {
            createdAt: {
                $gte: start,
                $lt: end,
            },
            ...(appId !== "all" ? {appId} : {}),
        };

        const data = await Event.aggregate([
            {
                $match: match,
            },

            {
                $sort: {
                    createdAt: 1,
                },
            },

            {
                $group: {
                    _id: {
                        deviceId: "$deviceId",
                        appId: "$appId",
                    },

                    country: {$last: "$country"},
                    region: {$last: "$region"},
                    city: {$last: "$city"},
                    platform: {$last: "$platform"},

                    totalSeconds: {
                        $sum: "$duration",
                    },

                    totalEvents: {
                        $sum: 1,
                    },

                    firstSeen: {
                        $min: "$createdAt",
                    },

                    lastSeen: {
                        $max: "$createdAt",
                    },
                },
            },

            {
                $project: {
                    _id: 0,

                    appId: "$_id.appId",
                    deviceId: "$_id.deviceId",

                    location: {
                        country: "$country",
                        region: "$region",
                        city: "$city",
                    },

                    platform: 1,

                    totalSeconds: 1,

                    totalMinutes: {
                        $round: [{$divide: ["$totalSeconds", 60]}, 2],
                    },

                    totalHours: {
                        $round: [{$divide: ["$totalSeconds", 3600]}, 2],
                    },

                    totalEvents: 1,
                    firstSeen: 1,
                    lastSeen: 1,
                },
            },

            {
                $sort: {
                    totalSeconds: -1,
                },
            },
        ]);

        const summary = data.reduce(
            (acc, user) => {
                acc.totalUsers += 1;
                acc.totalSeconds += user.totalSeconds;
                return acc;
            },
            {
                totalUsers: 0,
                totalSeconds: 0,
            }
        );

        return res.status(200).json({
            success: true,
            date,
            appId,
            summary: {
                totalUsers: summary.totalUsers,
                totalSeconds: summary.totalSeconds,
                totalMinutes: Number((summary.totalSeconds / 60).toFixed(2)),
                totalHours: Number((summary.totalSeconds / 3600).toFixed(2)),
            },
            count: data.length,
            data,
        });
    } catch (error) {
        console.error("Daily user stats error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get daily user statistics",
        });
    }
};

const getDeviceHistory = async (req, res) => {
    try {
        const {deviceId, appId = "all"} = req.query;

        const page = Math.max(Number.parseInt(req.query.page || "1", 10) || 1, 1);

        const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "50", 10) || 50, 1), 200);

        if (!deviceId || !deviceId.trim()) {
            return res.status(400).json({
                success: false,
                message: "deviceId is required",
            });
        }

        if (appId !== "all" && !isValidApp(appId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appId",
            });
        }

        const match = {
            deviceId: deviceId.trim(),
            ...(appId !== "all" ? {appId} : {}),
        };

        const skip = (page - 1) * limit;

        const result = await Event.aggregate([
            {
                $match: match,
            },
            {
                $facet: {
                    // Overall device summary
                    summary: [
                        {
                            $group: {
                                _id: null,

                                totalEvents: {$sum: 1},
                                totalSeconds: {$sum: "$duration"},

                                firstSeen: {$min: "$createdAt"},
                                lastSeen: {$max: "$createdAt"},

                                apps: {$addToSet: "$appId"},
                                platforms: {$addToSet: "$platform"},
                                countries: {$addToSet: "$country"},
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                totalEvents: 1,
                                totalSeconds: 1,

                                totalMinutes: {
                                    $round: [{$divide: ["$totalSeconds", 60]}, 2],
                                },

                                totalHours: {
                                    $round: [{$divide: ["$totalSeconds", 3600]}, 2],
                                },

                                firstSeen: 1,
                                lastSeen: 1,
                                apps: 1,
                                platforms: 1,
                                countries: 1,
                            },
                        },
                    ],

                    // Daily usage history
                    dailyStats: [
                        {
                            $group: {
                                _id: {
                                    year: {$year: "$createdAt"},
                                    month: {$month: "$createdAt"},
                                    day: {$dayOfMonth: "$createdAt"},
                                },

                                totalEvents: {$sum: 1},
                                totalSeconds: {$sum: "$duration"},

                                apps: {$addToSet: "$appId"},
                                cities: {$addToSet: "$city"},
                            },
                        },
                        {
                            $project: {
                                _id: 0,

                                date: {
                                    $dateFromParts: {
                                        year: "$_id.year",
                                        month: "$_id.month",
                                        day: "$_id.day",
                                    },
                                },

                                totalEvents: 1,
                                totalSeconds: 1,

                                totalMinutes: {
                                    $round: [{$divide: ["$totalSeconds", 60]}, 2],
                                },

                                apps: 1,
                                cities: 1,
                            },
                        },
                        {
                            $sort: {date: -1},
                        },
                    ],

                    // Complete event history with pagination
                    history: [
                        {
                            $sort: {createdAt: -1},
                        },
                        {
                            $skip: skip,
                        },
                        {
                            $limit: limit,
                        },
                        {
                            $project: {
                                _id: 1,
                                appId: 1,
                                deviceId: 1,
                                event: 1,
                                duration: 1,
                                platform: 1,

                                location: {
                                    country: "$country",
                                    region: "$region",
                                    city: "$city",
                                },

                                createdAt: 1,
                            },
                        },
                    ],

                    // Total records for pagination
                    pagination: [
                        {
                            $count: "totalRecords",
                        },
                    ],
                },
            },
        ]);

        const response = result[0];

        const summary = response.summary[0] || {
            totalEvents: 0,
            totalSeconds: 0,
            totalMinutes: 0,
            totalHours: 0,
            firstSeen: null,
            lastSeen: null,
            apps: [],
            platforms: [],
            countries: [],
        };

        const totalRecords = response.pagination[0]?.totalRecords || 0;

        return res.status(200).json({
            success: true,

            deviceId,
            appId,

            summary,

            pagination: {
                page,
                limit,
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                hasNextPage: page * limit < totalRecords,
                hasPrevPage: page > 1,
            },

            dailyStats: response.dailyStats,
            history: response.history,
        });
    } catch (error) {
        console.error("Device history error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get device history",
        });
    }
};


module.exports = {
    trackEvent,
    getStats,
    getDailyStats,
    getLocations,
    getDailyUserStats,
    getDeviceHistory
};
