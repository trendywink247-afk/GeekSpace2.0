// ============================================================
// Health module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Service health probes and monitoring
 *
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Returns cached component health status. No authentication required.
 *     security: []
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, degraded]
 *                 version:
 *                   type: string
 *                 components:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *
 * /health/version:
 *   get:
 *     tags: [Health]
 *     summary: Build version probe
 *     description: Returns the running build's package version, deployed git SHA, and Node.js runtime version. No authentication required.
 *     security: []
 *     responses:
 *       200:
 *         description: Version info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [version, commit, nodeVersion]
 *               properties:
 *                 version:
 *                   type: string
 *                   description: Server package version from package.json
 *                 commit:
 *                   type: string
 *                   description: Git SHA from GIT_SHA env var, or "unknown" when unset
 *                 nodeVersion:
 *                   type: string
 *                   description: Node.js runtime version (process.version)
 *
 * /health/detailed:
 *   get:
 *     tags: [Health]
 *     summary: Detailed health check (admin only)
 *     description: Runs live probes against all services with latency measurements.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed per-service health with latency
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, degraded]
 *                 probeTimeMs:
 *                   type: number
 *                 services:
 *                   type: object
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /health/stream:
 *   get:
 *     tags: [Health]
 *     summary: SSE health stream (admin only)
 *     description: Server-Sent Events stream pushing health snapshots every 15 seconds.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Admin token (alternative to Bearer header for EventSource)
 *     responses:
 *       200:
 *         description: SSE stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many SSE connections
 */
