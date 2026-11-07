const express = require("express");

const {
    trackEvent,
    getStats,
    getDailyStats,
    getLocations,
    getDailyUserStats,
    getDeviceHistory
} = require("../controllers/analyticsController");

const {validateTrack} = require("../middleware/validate");

const router = express.Router();

/**
 * @swagger
 * /api/track:
 *   post:
 *     tags:
 *       - Analytics
 *     summary: Track application event
 *     description: Records an application event such as app open, session start, session end, or app close.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - deviceId
 *               - event
 *             properties:
 *               appId:
 *                 type: string
 *                 description: Application identifier configured in APP_IDS
 *                 example: app1
 *               deviceId:
 *                 type: string
 *                 description: Anonymous device identifier
 *                 example: device-abc-123
 *               event:
 *                 type: string
 *                 enum:
 *                   - app_open
 *                   - session_start
 *                   - session_end
 *                   - app_close
 *                 example: app_open
 *               duration:
 *                 type: number
 *                 minimum: 0
 *                 description: Session duration in seconds
 *                 example: 120
 *               platform:
 *                 type: string
 *                 enum:
 *                   - android
 *                   - ios
 *                   - unknown
 *                 example: android
 *     responses:
 *       201:
 *         description: Event tracked successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
router.post("/track", validateTrack, trackEvent);

/**
 * @swagger
 * /api/stats:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get date-wise analytics
 *     parameters:
 *       - name: date
 *         in: query
 *         required: false
 *         description: Analytics date in YYYY-MM-DD format. Defaults to today in IST.
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-10-15"
 *       - name: appId
 *         in: query
 *         required: false
 *         description: Filter analytics for a specific application
 *         schema:
 *           type: string
 *         example: app1
 *     responses:
 *       200:
 *         description: Analytics data returned successfully
 *       400:
 *         description: Invalid date or appId
 *       500:
 *         description: Internal server error
 */
router.get("/stats", getStats);
/**
 * @swagger
 * /api/stats/daily:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get daily active users
 *     description: Returns daily unique users for the requested number of days.
 *     parameters:
 *       - name: days
 *         in: query
 *         required: false
 *         description: Number of days to return. Maximum 90 days.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 90
 *           default: 7
 *         example: 7
 *       - name: appId
 *         in: query
 *         required: false
 *         description: Filter daily analytics for a specific application
 *         schema:
 *           type: string
 *         example: app1
 *     responses:
 *       200:
 *         description: Daily analytics returned successfully
 *       400:
 *         description: Invalid appId
 *       500:
 *         description: Internal server error
 */
router.get("/stats/daily", getDailyStats);

/**
 * @swagger
 * /api/stats/locations:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get users by location
 *     description: Returns unique users grouped by country, region, and city.
 *     parameters:
 *       - name: appId
 *         in: query
 *         required: false
 *         description: Filter locations for a specific application
 *         schema:
 *           type: string
 *         example: app1
 *     responses:
 *       200:
 *         description: Location analytics returned successfully
 *       400:
 *         description: Invalid appId
 *       500:
 *         description: Internal server error
 */
router.get("/stats/locations", getLocations);

/**
 * @swagger
 * /api/daily-user-stats:
 *   get:
 *     tags:
 *       - Analytics
 *     description: Get daily usage, location and device statistics for each user. Use appId "all" to include all apps.
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *           example: all
 *         description: App ID or all for every app
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-11-07"
 *         description: Date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Daily user statistics retrieved successfully
 *       400:
 *         description: Invalid appId or date
 *       500:
 *         description: Internal server error
 */
router.get("/daily-user-stats", getDailyUserStats);

/**
 * @swagger
 * /api/device-history:
 *   get:
 *     tags:
 *       - Analytics
 *     description: Get complete usage and event history of a device.
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID
 *       - in: query
 *         name: appId
 *         required: false
 *         schema:
 *           type: string
 *           default: all
 *         description: App ID or all for every app
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Device history retrieved successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
router.get("/device-history", getDeviceHistory);

module.exports = router;
