
const WebTrackingEvent = require("../models/WebTrackingEvent");
const WebTrackingSession = require("../models/WebTrackingSession");

const MAX_BATCH_SIZE = 100;
const ACTIVE_WINDOW_MS = 90 * 1000;

const ALLOWED_EVENTS = new Set([
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
]);

const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const cleanString = (value, max = 2048) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

function getEventData(body) {
    const eventName = cleanString(body.eventName, 100);

    if (!ALLOWED_EVENTS.has(eventName)) {
        const error = new Error("Unsupported eventName");
        error.status = 400;
        throw error;
    }

    if (
        !body.appId ||
        !body.visitorId ||
        !body.sessionId ||
        typeof body.appId !== "string" ||
        typeof body.visitorId !== "string" ||
        typeof body.sessionId !== "string"
    ) {
        const error = new Error(
            "appId, visitorId and sessionId are required"
        );
        error.status = 400;
        throw error;
    }

    const properties =
        body.properties &&
            typeof body.properties === "object" &&
            !Array.isArray(body.properties)
            ? body.properties
            : {};

    return {
        appId: cleanString(body.appId, 100),
        platform: "web",
        visitorId: cleanString(body.visitorId, 150),
        sessionId: cleanString(body.sessionId, 150),
        eventName,
        pageUrl: cleanString(body.pageUrl),
        pageTitle: cleanString(body.pageTitle, 300),
        referrer: cleanString(body.referrer),
        source: cleanString(body.source, 100) || "direct",
        device: ["mobile", "desktop", "tablet"].includes(body.device)
            ? body.device
            : "unknown",
        browser: cleanString(body.browser, 100) || "unknown",
        // Location must come from a trusted server-side lookup or
        // an explicitly consented, permitted source.
        country: cleanString(body.country, 100) || null,
        region: cleanString(body.region, 100) || null,
        city: cleanString(body.city, 100) || null,
        properties,
        durationMs:
            Number.isFinite(body.durationMs) && body.durationMs >= 0
                ? Math.min(body.durationMs, 86400000)
                : null,
        occurredAt: new Date(),
    };
}

async function saveEvent(body) {
    const data = getEventData(body);

    await WebTrackingSession.updateOne(
        { sessionId: data.sessionId, appId: data.appId },
        {
            $set: {
                lastSeenAt: new Date(),
                currentPage: data.pageUrl,
            },
        }
    );

    return WebTrackingEvent.create(data);
}

function dateRange(query) {
    const from = query.from
        ? new Date(query.from)
        : new Date(Date.now() - 7 * 86400000);
    const to = query.to ? new Date(query.to) : new Date();

    if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        from > to
    ) {
        const error = new Error("Invalid date range");
        error.status = 400;
        throw error;
    }

    return { $gte: from, $lte: to };
}

function appFilter(req) {
    const appId = cleanString(req.query.appId, 100);
    if (!appId) {
        const error = new Error("appId query parameter is required");
        error.status = 400;
        throw error;
    }
    return appId;
}

function eventMatch(req) {
    return {
        appId: appFilter(req),
        occurredAt: dateRange(req.query),
    };
}

function getPage(req) {
    const limit = Math.min(
        Math.max(Number.parseInt(req.query.limit, 10) || 50, 1),
        200
    );
    const page = Math.max(
        Number.parseInt(req.query.page, 10) || 1,
        1
    );
    return { limit, skip: (page - 1) * limit };
}

exports.collect = asyncHandler(async (req, res) => {
    const event = await saveEvent(req.body);
    res.status(201).json({ success: true, eventId: event._id });
});

exports.batch = asyncHandler(async (req, res) => {
    const events = req.body.events;

    if (!Array.isArray(events) || events.length === 0 ||
        events.length > MAX_BATCH_SIZE) {
        return res.status(400).json({
            success: false,
            message: `events must contain 1-${MAX_BATCH_SIZE} items`,
        });
    }

    // Validate the entire batch before inserting.
    const documents = events.map(getEventData);
    const result = await WebTrackingEvent.insertMany(documents, {
        ordered: true,
    });

    res.status(201).json({
        success: true,
        received: result.length,
    });
});

exports.startSession = asyncHandler(async (req, res) => {
    const body = req.body;
    const appId = cleanString(body.appId, 100);
    const visitorId = cleanString(body.visitorId, 150);
    const sessionId = cleanString(body.sessionId, 150);

    if (!appId || !visitorId || !sessionId) {
        return res.status(400).json({
            success: false,
            message: "appId, visitorId and sessionId are required",
        });
    }

    const now = new Date();
    const session = await WebTrackingSession.findOneAndUpdate(
        { sessionId },
        {
            $set: {
                appId,
                visitorId,
                platform: "web",
                currentPage: cleanString(body.pageUrl),
                referrer: cleanString(body.referrer),
                source: cleanString(body.source, 100) || "direct",
                device: ["mobile", "desktop", "tablet"].includes(body.device)
                    ? body.device
                    : "unknown",
                browser: cleanString(body.browser, 100) || "unknown",
                country: cleanString(body.country, 100) || null,
                region: cleanString(body.region, 100) || null,
                city: cleanString(body.city, 100) || null,
                lastSeenAt: now,
                isActive: true,
                endedAt: null,
            },
            $setOnInsert: { startedAt: now },
        },
        { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({ success: true, session });
});

exports.heartbeat = asyncHandler(async (req, res) => {
    const { appId, sessionId } = req.body;

    const session = await WebTrackingSession.findOneAndUpdate(
        {
            appId: cleanString(appId, 100),
            sessionId: cleanString(sessionId, 150),
            isActive: true,
        },
        {
            $set: {
                lastSeenAt: new Date(),
                ...(req.body.pageUrl
                    ? { currentPage: cleanString(req.body.pageUrl) }
                    : {}),
            },
        },
        { new: true }
    );

    if (!session) {
        return res.status(404).json({
            success: false,
            message: "Active session not found",
        });
    }

    res.json({ success: true, lastSeenAt: session.lastSeenAt });
});

exports.endSession = asyncHandler(async (req, res) => {
    const { appId, sessionId } = req.body;

    const session = await WebTrackingSession.findOneAndUpdate(
        {
            appId: cleanString(appId, 100),
            sessionId: cleanString(sessionId, 150),
        },
        {
            $set: { isActive: false, endedAt: new Date() },
        },
        { new: true }
    );

    if (!session) {
        return res.status(404).json({
            success: false,
            message: "Session not found",
        });
    }

    res.json({ success: true });
});

exports.realtime = asyncHandler(async (req, res) => {
    const appId = appFilter(req);
    const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);

    const [sessions, activeCount, activeVisitors] = await Promise.all([
        WebTrackingSession.find({
            appId,
            isActive: true,
            lastSeenAt: { $gte: cutoff },
        })
            .sort({ lastSeenAt: -1 })
            .limit(200)
            .lean(),
        WebTrackingSession.countDocuments({
            appId,
            isActive: true,
            lastSeenAt: { $gte: cutoff },
        }),
        WebTrackingSession.distinct("visitorId", {
            appId,
            isActive: true,
            lastSeenAt: { $gte: cutoff },
        }),
    ]);

    res.json({
        success: true,
        activeSessions: activeCount,
        activeVisitors: activeVisitors.length,
        sessions,
        asOf: new Date(),
    });
});

exports.overview = asyncHandler(async (req, res) => {
    const match = eventMatch(req);

    const [summary, uniqueVisitors, sessions, previousEvents] =
        await Promise.all([
            WebTrackingEvent.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: null,
                        totalEvents: { $sum: 1 },
                        pageViews: {
                            $sum: { $cond: [{ $eq: ["$eventName", "page_view"] }, 1, 0] },
                        },
                        conversions: {
                            $sum: {
                                $cond: [
                                    { $in: ["$eventName", ["conversion", "purchase", "signup"]] },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            WebTrackingEvent.distinct("visitorId", match),
            WebTrackingSession.countDocuments({
                appId: match.appId,
                startedAt: match.occurredAt,
            }),
            Promise.resolve(null),
        ]);

    res.json({
        success: true,
        overview: {
            ...(summary[0] || {
                totalEvents: 0,
                pageViews: 0,
                conversions: 0,
            }),
            uniqueVisitors: uniqueVisitors.length,
            sessions,
        },
    });
});

exports.pages = asyncHandler(async (req, res) => {
    const result = await WebTrackingEvent.aggregate([
        { $match: { ...eventMatch(req), eventName: "page_view" } },
        {
            $group: {
                _id: "$pageUrl",
                views: { $sum: 1 },
                visitors: { $addToSet: "$visitorId" },
            },
        },
        {
            $project: {
                _id: 0,
                pageUrl: "$_id",
                views: 1,
                uniqueVisitors: { $size: "$visitors" },
            },
        },
        { $sort: { views: -1 } },
        { $limit: 100 },
    ]);

    res.json({ success: true, pages: result });
});

exports.events = asyncHandler(async (req, res) => {
    const { limit, skip } = getPage(req);
    const filter = eventMatch(req);
    if (req.query.eventName) {
        filter.eventName = cleanString(req.query.eventName, 100);
    }

    const [events, total] = await Promise.all([
        WebTrackingEvent.find(filter)
            .sort({ occurredAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        WebTrackingEvent.countDocuments(filter),
    ]);

    res.json({ success: true, events, total, limit, page: skip / limit + 1 });
});

exports.sources = asyncHandler(async (req, res) => {
    const sources = await WebTrackingEvent.aggregate([
        { $match: { ...eventMatch(req), eventName: "page_view" } },
        {
            $group: {
                _id: "$source",
                visits: { $sum: 1 },
                visitors: { $addToSet: "$visitorId" },
            },
        },
        {
            $project: {
                _id: 0,
                source: "$_id",
                visits: 1,
                uniqueVisitors: { $size: "$visitors" },
            },
        },
        { $sort: { visits: -1 } },
    ]);

    res.json({ success: true, sources });
});

exports.devices = asyncHandler(async (req, res) => {
    const devices = await WebTrackingEvent.aggregate([
        { $match: { ...eventMatch(req), eventName: "page_view" } },
        {
            $group: {
                _id: { device: "$device", browser: "$browser" },
                pageViews: { $sum: 1 },
                visitors: { $addToSet: "$visitorId" },
            },
        },
        {
            $project: {
                _id: 0,
                device: "$_id.device",
                browser: "$_id.browser",
                pageViews: 1,
                uniqueVisitors: { $size: "$visitors" },
            },
        },
        { $sort: { pageViews: -1 } },
    ]);

    res.json({ success: true, devices });
});

exports.locations = asyncHandler(async (req, res) => {
    const locations = await WebTrackingEvent.aggregate([
        { $match: { ...eventMatch(req), eventName: "page_view" } },
        {
            $group: {
                _id: {
                    country: "$country",
                    region: "$region",
                    city: "$city",
                },
                visits: { $sum: 1 },
                visitors: { $addToSet: "$visitorId" },
            },
        },
        {
            $project: {
                _id: 0,
                country: "$_id.country",
                region: "$_id.region",
                city: "$_id.city",
                visits: 1,
                uniqueVisitors: { $size: "$visitors" },
            },
        },
        { $sort: { visits: -1 } },
        { $limit: 200 },
    ]);

    res.json({ success: true, locations });
});

exports.funnels = asyncHandler(async (req, res) => {
    const match = eventMatch(req);
    const stages = ["page_view", "signup", "purchase"];

    const counts = await WebTrackingEvent.aggregate([
        { $match: { ...match, eventName: { $in: stages } } },
        {
            $group: {
                _id: "$eventName",
                visitors: { $addToSet: "$visitorId" },
                events: { $sum: 1 },
            },
        },
    ]);

    const map = new Map(counts.map((item) => [item._id, item]));
    const visitCount = map.get("page_view")?.visitors.length || 0;

    res.json({
        success: true,
        funnel: stages.map((stage) => {
            const item = map.get(stage);
            const visitors = item?.visitors.length || 0;
            return {
                stage,
                visitors,
                events: item?.events || 0,
                conversionRate:
                    visitCount > 0 ? Number(((visitors / visitCount) * 100).toFixed(2)) : 0,
            };
        }),
    });
});

exports.performance = asyncHandler(async (req, res) => {
    const result = await WebTrackingEvent.aggregate([
        {
            $match: {
                ...eventMatch(req),
                eventName: { $in: ["performance", "error"] },
            },
        },
        {
            $group: {
                _id: "$eventName",
                count: { $sum: 1 },
                averageDurationMs: { $avg: "$durationMs" },
            },
        },
    ]);

    res.json({ success: true, performance: result });
});
