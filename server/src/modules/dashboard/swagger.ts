// ============================================================
// Dashboard module — Swagger / JSDoc annotations
// ============================================================
//
// These JSDoc blocks document the dashboard UI data-feed
// endpoints for OpenAPI/Swagger tooling. They are not executed
// at runtime; they exist purely as machine-readable API docs.

// ── Dashboard ────────────────────────────────────────────────

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Full dashboard statistics
 *     description: >
 *       Returns comprehensive dashboard data including message counts,
 *       API call stats, agent status, weekly chart data, hourly
 *       activity, reminder breakdown, recent activity, and connected
 *       services. Requires authentication.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/dashboard/quick-stats:
 *   get:
 *     summary: Lightweight quick stats
 *     description: >
 *       Returns a minimal 3-count payload (active reminders, messages
 *       today, active automations). Cached in Redis with a 60-second
 *       TTL for low-latency polling.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quick stats payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuickStats'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     summary: Unified dashboard overview
 *     description: >
 *       Single-fetch endpoint for the overview page. Returns a
 *       personalized greeting, reminders due today, habit progress,
 *       calendar events, weekly stats, and recent conversations.
 *       Fresh data (reminders, habits) is always queried from DB;
 *       weekly stats and conversations are cached for 60 seconds.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardOverview'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/dashboard/contact:
 *   post:
 *     summary: Submit contact form
 *     description: >
 *       Stores a contact form submission (name, email, company,
 *       message) and returns a success acknowledgement.
 *     tags: [Dashboard]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactSubmission'
 *     responses:
 *       200:
 *         description: Submission accepted
 *       400:
 *         description: Validation error
 */

// ── Activity ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/activity:
 *   get:
 *     summary: Activity feed
 *     description: >
 *       Returns a paginated, filterable activity log. Supports query
 *       parameters for search (q), type, date range (from/to), and
 *       category filtering. Cached with a 4-second per-user polling
 *       cooldown and 8-second Redis TTL.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search in action and details
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Portfolio, Reminders, Integrations, Agent]
 *     responses:
 *       200:
 *         description: Paginated activity entries
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivityFeed'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal error
 */

/**
 * @swagger
 * /api/activity:
 *   delete:
 *     summary: Clear all activity
 *     description: Deletes all activity log entries for the authenticated user.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/activity/heatmap:
 *   get:
 *     summary: 90-day activity heatmap
 *     description: >
 *       Returns daily activity counts for the last 90 days,
 *       suitable for rendering a GitHub-style heatmap.
 *       Cached in Redis for 30 seconds.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Heatmap data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 heatmap:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HeatmapPoint'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/activity/stats:
 *   get:
 *     summary: 7-day daily activity stats
 *     description: >
 *       Returns per-day message and reminder counts for the last
 *       7 days. Cached in Redis for 30 seconds.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 days:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityDayStats'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/activity/stream:
 *   get:
 *     summary: Real-time activity stream (SSE)
 *     description: >
 *       Opens a Server-Sent Events connection for real-time
 *       activity push. Sends heartbeat pings every 30 seconds.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE event stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */

/**
 * @swagger
 * /api/activity/export:
 *   get:
 *     summary: Export activity as CSV
 *     description: >
 *       Downloads the last 500 activity entries as a CSV file
 *       with columns: date, time, type, description.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */

/**
 * @swagger
 * /api/activity/{id}:
 *   delete:
 *     summary: Delete single activity entry
 *     description: Deletes a specific activity log entry by ID.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entry deleted
 *       404:
 *         description: Entry not found
 */

// ── Analytics ────────────────────────────────────────────────

/**
 * @swagger
 * /api/analytics/snapshot:
 *   get:
 *     summary: Daily analytics snapshots
 *     description: Returns up to 365 days of daily analytics snapshots.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *           maximum: 365
 *     responses:
 *       200:
 *         description: Snapshot array
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/analytics/weekly:
 *   get:
 *     summary: Weekly summary with AI insight
 *     description: Returns the current week's summary including an AI-generated insight.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Weekly summary
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/analytics/heatmap:
 *   get:
 *     summary: 365-day activity heatmap
 *     description: Returns daily activity counts for the last year.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Heatmap data
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/analytics/agents:
 *   get:
 *     summary: Agent usage statistics
 *     description: Returns agent usage data for the specified number of days (default 30).
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *           maximum: 365
 *     responses:
 *       200:
 *         description: Agent usage data
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/analytics/topics:
 *   get:
 *     summary: Top topics from memories and notes
 *     description: Extracts and returns trending topics from user data.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Topic list
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/analytics/insights:
 *   get:
 *     summary: AI-powered personalized insights
 *     description: >
 *       Generates 4 personalized productivity insights using LLM
 *       analysis of the user's weekly data. Falls back to rule-based
 *       insights if the LLM is unavailable. Cached for 1 hour;
 *       pass refresh=true to force regeneration.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Force regeneration of insights
 *     responses:
 *       200:
 *         description: Insights payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsInsightsResponse'
 *       401:
 *         description: Unauthorized
 */

// ── Report ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/report:
 *   post:
 *     summary: Flag an AI response for review
 *     description: >
 *       Submits a report against an AI response. Valid reasons are
 *       harmful, inaccurate, inappropriate, or other.
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportSubmission'
 *     responses:
 *       201:
 *         description: Report submitted
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/report:
 *   get:
 *     summary: List own reports
 *     description: Returns the authenticated user's submitted reports (up to 50).
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reports list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reports:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportSummary'
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */

// ── Inbox ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/inbox:
 *   get:
 *     summary: List inbox messages
 *     description: >
 *       Returns paginated inbox messages. Supports filtering by
 *       unreadOnly and source.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: string
 *           enum: ['true', '1', 'false', '0']
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [telegram, whatsapp, system, agent]
 *     responses:
 *       200:
 *         description: Inbox messages
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/inbox/count:
 *   get:
 *     summary: Unread message count
 *     description: Returns the number of unread inbox messages.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unread:
 *                   type: integer
 */

/**
 * @swagger
 * /api/inbox/{id}/read:
 *   patch:
 *     summary: Mark message as read
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Marked as read
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Message not found
 */

/**
 * @swagger
 * /api/inbox/{id}/archive:
 *   patch:
 *     summary: Archive a message
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Archived
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Message not found
 */

/**
 * @swagger
 * /api/inbox/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Message not found
 */

/**
 * @swagger
 * /api/inbox/{id}/reply:
 *   post:
 *     summary: Reply to an inbox message via original channel
 *     description: >
 *       Sends a reply through the original channel (Telegram or
 *       WhatsApp only). Falls back to the suggested_reply if no
 *       text is provided. Reply text is limited to 2000 characters.
 *       Marks the message as read after sending.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Reply sent
 *       400:
 *         description: Invalid ID, no text, or unsupported source
 *       404:
 *         description: Message not found
 *       500:
 *         description: Failed to send via channel
 */

/**
 * @swagger
 * /api/inbox:
 *   post:
 *     summary: Add inbox message (internal/testing)
 *     description: >
 *       Manually creates an inbox message. Runs triage on the
 *       message before returning.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InboxCreateBody'
 *     responses:
 *       201:
 *         description: Message created
 *       400:
 *         description: Validation error
 */

// ── Recommendations ──────────────────────────────────────────

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *     summary: Personalized feature recommendations
 *     description: >
 *       Returns up to N personalized feature recommendations
 *       based on the user's usage patterns.
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Recommendations list
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Generation failed
 */

/**
 * @swagger
 * /api/recommendations/dismiss:
 *   post:
 *     summary: Dismiss a recommendation
 *     description: Marks a feature recommendation as dismissed so it won't appear again.
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecommendationDismissBody'
 *     responses:
 *       200:
 *         description: Dismissed
 *       400:
 *         description: Missing feature field
 */
