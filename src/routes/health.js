const express = require("express");

const router = express.Router();

/**
 * @swagger
 * /api/:
 *   get:
 *     tags:
 *       - System
 *     summary: API health check
 *     description: Returns the current status and basic information about the App Analytics API.
 *     responses:
 *       200:
 *         description: API is running successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: OK
 *                 service:
 *                   type: string
 *                   example: App Analytics API
 *                 time:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-09-14T12:00:00.000Z"
 */
router.get("/", (req, res) => {
    res.json({
        success: true,
        status: "OK",
        service: "App Analytics API",
        time: new Date().toISOString(),
    });
});

module.exports = router;
