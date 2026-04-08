/**
 * GET /api/office/services
 *
 * Returns real-time container / service health for the Office canvas
 * station cards. Results are cached for 15 seconds in-memory.
 *
 * @module modules/office/routes/services
 */

import { Router } from "express";
import { type AuthRequest, requireAuth } from "../../../middleware/auth.js";
import { getServicesHealth } from "../services-health.js";

export const officeServicesRouter = Router();

/**
 * @swagger
 * /api/office/services:
 *   get:
 *     summary: Container / service health for Office canvas
 *     description: >
 *       Probes each station's backing container and returns up/degraded/down
 *       status with latency. Results are cached for 15 seconds.
 *     tags: [Office]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Station health array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       container:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [up, degraded, down]
 *                       latencyMs:
 *                         type: number
 *                         nullable: true
 *                 checkedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 */
officeServicesRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
	try {
		const result = await getServicesHealth();
		res.json(result);
	} catch (err) {
		res.status(500).json({ error: "Failed to check service health" });
	}
});
