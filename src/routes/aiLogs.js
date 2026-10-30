const express = require("express");
const {createAiLog, getAiLogs} = require("../controllers/aiLogController");

const router = express.Router();

/**
 * @swagger
 * /api/log:
 *   post:
 *     summary: Create an AI usage log
 *     tags: [AI Logs]
 *     description: Saves AI model success and error information.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - model
 *               - status
 *               - statusCode
 *               - durationMs
 *             properties:
 *               service:
 *                 type: string
 *                 example: ai
 *               provider:
 *                 type: string
 *                 example: openai-compatible
 *               model:
 *                 type: string
 *                 example: llama-3.3-70b-versatile
 *               status:
 *                 type: string
 *                 enum: [success, error]
 *                 example: success
 *               statusCode:
 *                 type: integer
 *                 example: 200
 *               errorCode:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               errorKind:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               durationMs:
 *                 type: number
 *                 example: 850
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: AI log saved successfully
 *       400:
 *         description: Invalid log payload
 *       500:
 *         description: Internal server error
 */
router.post("/", createAiLog);

/**
 * @swagger
 * /api/log:
 *   get:
 *     summary: Get AI usage logs
 *     tags: [AI Logs]
 *     description: Returns paginated AI logs with optional filters.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Records per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, error]
 *         description: Filter by request status
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Filter by AI model name
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *         description: Filter by AI provider
 *     responses:
 *       200:
 *         description: AI logs retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", getAiLogs);

module.exports = router;
