const express = require("express");
const router = express.Router();
const controller = require("../controllers/webTrackingController");
const {
    createWebTrackingAuthMiddleware,
} = require("../middleware/webTrackingAuth");

router.use(createWebTrackingAuthMiddleware());
router.use(express.json({ limit: "100kb" }));

const collectSchema = {
    type: "object",
    required: ["appId", "visitorId", "sessionId", "eventName"],
    properties: {
        appId: {type: "string", example: "web_app_1"},
        visitorId: {type: "string", example: "visitor_abc123"},
        sessionId: {type: "string", example: "session_xyz123"},
        eventName: {
            type: "string",
            enum: [
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
            ],
            example: "page_view",
        },
        pageUrl: {type: "string", example: "https://example.com/pricing"},
        pageTitle: {type: "string"},
        referrer: {type: "string"},
        source: {type: "string", example: "google"},
        device: {type: "string", enum: ["mobile", "desktop", "tablet"]},
        browser: {type: "string", example: "Chrome"},
        country: {type: "string", nullable: true},
        region: {type: "string", nullable: true},
        city: {type: "string", nullable: true},
        durationMs: {type: "number"},
        properties: {type: "object", additionalProperties: true},
    },
};

const queryParams = [
    {in: "query", name: "appId", required: true, schema: {type: "string"}},
    {in: "query", name: "from", schema: {type: "string", format: "date-time"}},
    {in: "query", name: "to", schema: {type: "string", format: "date-time"}},
];

/**
 * @swagger
 * tags:
 *   - name: Web Tracking
 *     description: Web analytics, sessions and real-time tracking
 */

/**
 * @swagger
 * /api/web-tracking/collect:
 *   post:
 *     tags: [Web Tracking]
 *     summary: Collect a single web tracking event
 *     security:
 *       - WebTrackingToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebTrackingEventInput'
 *     responses:
 *       201:
 *         description: Event stored
 *       400:
 *         description: Invalid event data
 */
router.post("/collect", controller.collect);

/**
 * @swagger
 * /api/web-tracking/batch:
 *   post:
 *     tags: [Web Tracking]
 *     summary: Collect multiple events in one request
 *     security:
 *       - WebTrackingToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [events]
 *             properties:
 *               events:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   $ref: '#/components/schemas/WebTrackingEventInput'
 *     responses:
 *       201:
 *         description: Events stored
 *       400:
 *         description: Invalid batch
 */
router.post("/batch", controller.batch);

/**
 * @swagger
 * /api/web-tracking/session/start:
 *   post:
 *     tags: [Web Tracking]
 *     summary: Start a web visitor session
 *     security:
 *       - WebTrackingToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [appId, visitorId, sessionId]
 *             properties:
 *               appId: { type: string }
 *               visitorId: { type: string }
 *               sessionId: { type: string }
 *               pageUrl: { type: string }
 *               referrer: { type: string }
 *               source: { type: string }
 *               device: { type: string }
 *               browser: { type: string }
 *     responses:
 *       201:
 *         description: Session created or resumed
 */
router.post("/session/start", controller.startSession);

/**
 * @swagger
 * /api/web-tracking/session/heartbeat:
 *   post:
 *     tags: [Web Tracking]
 *     summary: Update an active session heartbeat
 *     security:
 *       - WebTrackingToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [appId, sessionId]
 *             properties:
 *               appId: { type: string }
 *               sessionId: { type: string }
 *               pageUrl: { type: string }
 *     responses:
 *       200:
 *         description: Heartbeat updated
 *       404:
 *         description: Active session not found
 */
router.post("/session/heartbeat", controller.heartbeat);

/**
 * @swagger
 * /api/web-tracking/session/end:
 *   post:
 *     tags: [Web Tracking]
 *     summary: End a web visitor session
 *     security:
 *       - WebTrackingToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [appId, sessionId]
 *             properties:
 *               appId: { type: string }
 *               sessionId: { type: string }
 *     responses:
 *       200:
 *         description: Session ended
 *       404:
 *         description: Session not found
 */
router.post("/session/end", controller.endSession);

/**
 * @swagger
 * /api/web-tracking/realtime:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get currently active sessions and visitors
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Current active visitors
 */
router.get("/realtime", controller.realtime);

/**
 * @swagger
 * /api/web-tracking/overview:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get visitors, page views, sessions and conversions
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Analytics overview
 */
router.get("/overview", controller.overview);

/**
 * @swagger
 * /api/web-tracking/pages:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get popular pages and their views
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Page analytics
 */
router.get("/pages", controller.pages);

/**
 * @swagger
 * /api/web-tracking/events:
 *   get:
 *     tags: [Web Tracking]
 *     summary: List recorded tracking events
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: eventName
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200:
 *         description: Paginated event list
 */
router.get("/events", controller.events);

/**
 * @swagger
 * /api/web-tracking/sources:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get traffic sources and referrals
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Traffic source breakdown
 */
router.get("/sources", controller.sources);

/**
 * @swagger
 * /api/web-tracking/devices:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get device and browser statistics
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Device and browser breakdown
 */
router.get("/devices", controller.devices);

/**
 * @swagger
 * /api/web-tracking/locations:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get approximate visitor locations
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Location breakdown
 */
router.get("/locations", controller.locations);

/**
 * @swagger
 * /api/web-tracking/funnels:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get page view to signup to purchase funnel
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Funnel conversion statistics
 */
router.get("/funnels", controller.funnels);

/**
 * @swagger
 * /api/web-tracking/performance:
 *   get:
 *     tags: [Web Tracking]
 *     summary: Get performance and error event statistics
 *     security:
 *       - WebTrackingToken: []
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Performance and error statistics
 */
router.get("/performance", controller.performance);

module.exports = router;
