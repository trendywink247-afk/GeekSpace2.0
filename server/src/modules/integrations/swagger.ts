// ============================================================
// Integrations module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Integrations
 *     description: Third-party integrations — Telegram, Gmail, Calendar, Social Media
 *
 * /integrations:
 *   get:
 *     tags: [Integrations]
 *     summary: List integrations
 *     description: Returns all connected integrations for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of integrations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [telegram, gmail, calendar, social, custom_bot]
 *                   enabled:
 *                     type: boolean
 *                   connected_at:
 *                     type: string
 *                     format: date-time
 *                   last_sync_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /integrations/telegram/link:
 *   post:
 *     tags: [Integrations]
 *     summary: Link Telegram account
 *     description: Links a Telegram chat to the authenticated user for notifications and commands.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [chatId]
 *             properties:
 *               chatId:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Telegram linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 linked:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /gmail/threads:
 *   get:
 *     tags: [Integrations]
 *     summary: List Gmail threads
 *     description: Returns synced Gmail threads for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of threads to return
 *     responses:
 *       200:
 *         description: List of Gmail threads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   subject:
 *                     type: string
 *                   from:
 *                     type: string
 *                   snippet:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date-time
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /gmail/sync:
 *   post:
 *     tags: [Integrations]
 *     summary: Sync Gmail
 *     description: Triggers an immediate Gmail sync for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 synced:
 *                   type: number
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /calendar/events:
 *   get:
 *     tags: [Integrations]
 *     summary: List calendar events
 *     description: Returns upcoming calendar events for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days ahead to fetch events
 *     responses:
 *       200:
 *         description: List of calendar events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   start_time:
 *                     type: number
 *                   end_time:
 *                     type: number
 *                     nullable: true
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /calendar/sync:
 *   post:
 *     tags: [Integrations]
 *     summary: Sync calendar
 *     description: Triggers an immediate Google Calendar sync for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 synced:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /social-media/accounts:
 *   get:
 *     tags: [Integrations]
 *     summary: List social media accounts
 *     description: Returns all linked social media accounts for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of social accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   platform:
 *                     type: string
 *                   username:
 *                     type: string
 *                   profile_url:
 *                     type: string
 *                     nullable: true
 *                   connected_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
