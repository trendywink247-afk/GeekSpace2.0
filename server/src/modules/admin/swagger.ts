// ============================================================
// Admin module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin dashboard, stats, exports, and management
 *   - name: Dev
 *     description: Admin-only developer/ops bridge (DevClaw)
 *   - name: Debug
 *     description: Routing debug and trace inspection (TEST_MODE only)
 *   - name: Routes
 *     description: API route reference
 *   - name: Models
 *     description: Free model discovery and changelog
 *
 * /admin/health:
 *   get:
 *     tags: [Admin]
 *     summary: Admin health check
 *     description: Returns DB, Redis, Ollama, and PicoClaw statuses.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Component health statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 db:
 *                   type: string
 *                   enum: [ok, down]
 *                 redis:
 *                   type: string
 *                   enum: [ok, down]
 *                 ollama:
 *                   type: string
 *                   enum: [ok, down]
 *                 picoclaw:
 *                   type: string
 *                   enum: [ok, down, not_configured]
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Platform statistics
 *     description: User counts, task stats, DB size, memory usage, and suggestion metrics.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin statistics snapshot
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/stream:
 *   get:
 *     tags: [Admin]
 *     summary: SSE admin event stream
 *     description: Server-Sent Events stream pushing stats, health, and metrics every 10 seconds.
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
 *
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users
 *     description: Paginated user listing with search support.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated user list
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/usage:
 *   get:
 *     tags: [Admin]
 *     summary: Platform-wide usage
 *     description: Aggregate usage statistics across all users.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage breakdown
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/audit:
 *   get:
 *     tags: [Admin]
 *     summary: Audit log
 *     description: Recent admin action audit entries.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Audit log entries
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/export/users:
 *   get:
 *     tags: [Admin]
 *     summary: Export users CSV
 *     description: Download all users as CSV.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/export/activity:
 *   get:
 *     tags: [Admin]
 *     summary: Export activity CSV
 *     description: Download recent activity log as CSV.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Dashboard JSON data
 *     description: Legacy dashboard data endpoint (X-Admin-Password auth).
 *     security:
 *       - adminPassword: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/suggestions/queue:
 *   get:
 *     tags: [Admin]
 *     summary: Suggestion moderation queue
 *     description: Paginated list of suggestions for admin review.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Suggestions list
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/suggestions/triage:
 *   post:
 *     tags: [Admin]
 *     summary: AI-powered suggestion triage
 *     description: Runs AI triage on pending suggestions. Rate limited to 1 per 60s.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Triage results
 *       429:
 *         description: Rate limited
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/invite:
 *   post:
 *     tags: [Admin]
 *     summary: Create invite code
 *     description: Generate a new invite code for user registration.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invite code created
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /admin/token-stats:
 *   get:
 *     tags: [Admin]
 *     summary: Token usage statistics
 *     description: Today and weekly token consumption with compression rate.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token stats
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /dev/status:
 *   get:
 *     tags: [Dev]
 *     summary: System and git status
 *     description: Returns version, git SHA, branch, uptime, and Node version.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dev status info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                 gitSha:
 *                   type: string
 *                 branch:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 nodeVersion:
 *                   type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /dev/run-checks:
 *   post:
 *     tags: [Dev]
 *     summary: Run allowlisted dev command
 *     description: Execute a pre-approved dev/CI command on the server.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command]
 *             properties:
 *               command:
 *                 type: string
 *     responses:
 *       200:
 *         description: Command result
 *       400:
 *         description: Unknown or missing command
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /dev/git-push:
 *   post:
 *     tags: [Dev]
 *     summary: Push branch to origin
 *     description: Push an existing local branch to remote origin.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branch]
 *             properties:
 *               branch:
 *                 type: string
 *     responses:
 *       200:
 *         description: Push result
 *       400:
 *         description: Invalid branch name
 *       401:
 *         $ref: '#/components/schemas/Error'
 *       503:
 *         description: GITHUB_DEV_TOKEN not configured
 *
 * /dev/create-pr:
 *   post:
 *     tags: [Dev]
 *     summary: Create a pull request
 *     description: Create a branch and open a GitHub PR.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchName, title]
 *             properties:
 *               branchName:
 *                 type: string
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *     responses:
 *       200:
 *         description: PR created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prNumber:
 *                   type: integer
 *                 prUrl:
 *                   type: string
 *                 branch:
 *                   type: string
 *                 sha:
 *                   type: string
 *       400:
 *         description: Invalid branch name or missing title
 *       401:
 *         $ref: '#/components/schemas/Error'
 *       503:
 *         description: GITHUB_DEV_TOKEN not configured
 *
 * /dev/audit-log:
 *   get:
 *     tags: [Dev]
 *     summary: Dev action audit log
 *     description: Recent dev bridge actions with timestamps and outcomes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Audit entries
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /debug/routing/traces:
 *   get:
 *     tags: [Debug]
 *     summary: Routing traces
 *     description: Recent LLM routing decisions with optional filtering. TEST_MODE only.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *       - in: query
 *         name: intent
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered routing traces
 *       403:
 *         description: Not in TEST_MODE
 *
 * /debug/routing/stats:
 *   get:
 *     tags: [Debug]
 *     summary: Routing statistics
 *     description: Aggregate routing stats including provider distribution and latency. TEST_MODE only.
 *     security: []
 *     responses:
 *       200:
 *         description: Routing statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRequests:
 *                   type: integer
 *                 averageLatencyMs:
 *                   type: number
 *                 ollamaAvailabilityRate:
 *                   type: number
 *                 forcedRoutingCount:
 *                   type: integer
 *                 providerDistribution:
 *                   type: object
 *                 reasonDistribution:
 *                   type: object
 *                 intentDistribution:
 *                   type: object
 *       403:
 *         description: Not in TEST_MODE
 *
 * /debug/routing/clear:
 *   post:
 *     tags: [Debug]
 *     summary: Clear routing traces
 *     description: Reset all stored routing traces. TEST_MODE only.
 *     security: []
 *     responses:
 *       200:
 *         description: Traces cleared
 *       403:
 *         description: Not in TEST_MODE
 *
 * /debug/routing/config:
 *   get:
 *     tags: [Debug]
 *     summary: Routing configuration
 *     description: Current LLM routing configuration (sanitized, no secrets). TEST_MODE only.
 *     security: []
 *     responses:
 *       200:
 *         description: Sanitized routing config
 *       403:
 *         description: Not in TEST_MODE
 *
 * /routes:
 *   get:
 *     tags: [Routes]
 *     summary: API route reference
 *     description: Static list of all important API endpoints for operator reference.
 *     security: []
 *     responses:
 *       200:
 *         description: Route listing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                 description:
 *                   type: string
 *                 routes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       method:
 *                         type: string
 *                       path:
 *                         type: string
 *                       auth:
 *                         type: boolean
 *                       description:
 *                         type: string
 *
 * /models/free:
 *   get:
 *     tags: [Models]
 *     summary: List free models
 *     description: All active and newly discovered free LLM models, sorted by curation and context length.
 *     security: []
 *     responses:
 *       200:
 *         description: Free model listing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       summary:
 *                         type: string
 *                       contextLength:
 *                         type: integer
 *                       parameters:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                       curated:
 *                         type: boolean
 *                       isNew:
 *                         type: boolean
 *                 lastUpdated:
 *                   type: string
 *                   nullable: true
 *                   format: date-time
 *
 * /models/changelog:
 *   get:
 *     tags: [Models]
 *     summary: Model changelog
 *     description: Last 30 days of model additions, removals, and status changes.
 *     security: []
 *     responses:
 *       200:
 *         description: Changelog entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       modelId:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       event:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 */
