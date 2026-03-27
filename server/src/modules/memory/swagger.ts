// ============================================================
// Memory module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Memory
 *     description: User memory storage and retrieval
 *   - name: Search
 *     description: Global full-text and semantic search
 *
 * /api/memory:
 *   get:
 *     tags: [Memory]
 *     summary: List user memories
 *     description: Returns all stored memories for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of memory entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   key:
 *                     type: string
 *                   value:
 *                     type: string
 *                   source:
 *                     type: string
 *                   confidence:
 *                     type: number
 *                   last_used:
 *                     type: integer
 *       401:
 *         $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Memory]
 *     summary: Create or update a memory
 *     description: Upserts a memory entry keyed by the provided key.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value]
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *               source:
 *                 type: string
 *               confidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *     responses:
 *       200:
 *         description: Memory created or updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /api/memory/{id}:
 *   delete:
 *     tags: [Memory]
 *     summary: Delete a memory
 *     description: Deletes a specific memory entry by ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Memory entry ID
 *     responses:
 *       200:
 *         description: Memory deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *
 * /api/memory/context:
 *   get:
 *     tags: [Memory]
 *     summary: Get formatted memory context
 *     description: Returns a pre-formatted string of relevant memories for use in AI context windows.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Formatted memory context string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 context:
 *                   type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /api/search:
 *   get:
 *     tags: [Search]
 *     summary: Global search
 *     description: Searches across notes, reminders, memories, habits, and conversations using full-text and semantic search.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query string
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *         description: "Comma-separated content types to search: notes,reminders,memories,habits,conversations"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of results (1-50)
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       score:
 *                         type: number
 *       400:
 *         description: Missing required query parameter q
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
