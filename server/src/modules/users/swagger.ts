// ============================================================
// Users module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User account management, profile, and preferences
 *   - name: Usage
 *     description: Token usage tracking, billing, and analytics
 *   - name: API Keys
 *     description: Third-party API key management
 *   - name: Features
 *     description: Per-user and system-wide feature flags
 *
 * # ── Users ──────────────────────────────────────────────────
 *
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     description: Returns the authenticated user's full profile, served from Redis cache when available (60s TTL).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       404:
 *         description: User not found
 *   patch:
 *     tags: [Users]
 *     summary: Update current user profile
 *     description: Partial update of profile fields including name, bio, theme, notifications, and privacy settings.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated user profile
 *       409:
 *         description: Username already taken
 *
 * /api/users/notification-email:
 *   patch:
 *     tags: [Users]
 *     summary: Update notification email preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               address:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Updated notification email settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 address:
 *                   type: string
 *                   nullable: true
 *
 * /api/users/me/timezone:
 *   patch:
 *     tags: [Users]
 *     summary: Update user timezone
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timezone:
 *                 type: string
 *                 example: Asia/Kolkata
 *     responses:
 *       200:
 *         description: Timezone updated
 *       400:
 *         description: Invalid timezone identifier
 *
 * /api/users/{username}/public:
 *   get:
 *     tags: [Users]
 *     summary: Get public user profile
 *     description: Returns a public-facing profile. Location is hidden if privacy setting is off.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public user profile
 *       404:
 *         description: User not found
 *
 * /api/users/me/model:
 *   put:
 *     tags: [Users]
 *     summary: Set preferred AI model
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 enum: [auto, local, cloud, premium]
 *     responses:
 *       200:
 *         description: Model preference saved
 *       400:
 *         description: Invalid model value
 *   get:
 *     tags: [Users]
 *     summary: Get preferred AI model
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current model preference
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferredModel:
 *                   type: string
 *                   enum: [auto, local, cloud, premium]
 *
 * /api/users/me/change-password:
 *   post:
 *     tags: [Users]
 *     summary: Change password
 *     description: Validates current password, updates hash, and invalidates all existing sessions.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password is incorrect
 *
 * /api/users/{id}/block:
 *   post:
 *     tags: [Users]
 *     summary: Block a user
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
 *         description: User blocked
 *       400:
 *         description: Cannot block yourself
 *       404:
 *         description: User not found
 *   delete:
 *     tags: [Users]
 *     summary: Unblock a user
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
 *         description: User unblocked
 *
 * /api/users/blocked:
 *   get:
 *     tags: [Users]
 *     summary: List blocked users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of blocked users with count
 *
 * # ── Usage ──────────────────────────────────────────────────
 *
 * /api/usage/summary:
 *   get:
 *     tags: [Usage]
 *     summary: Usage summary with cost and token totals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: month
 *     responses:
 *       200:
 *         description: Aggregated usage summary with forecast
 *
 * /api/usage/billing:
 *   get:
 *     tags: [Usage]
 *     summary: Billing info and monthly allowance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plan, credits, allowance, and month-to-date usage
 *
 * /api/usage/chart:
 *   get:
 *     tags: [Usage]
 *     summary: Time-series chart data
 *     description: Daily aggregated data shaped for Recharts, with per-provider breakdown.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 14d, 30d]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Array of daily usage entries
 *
 * /api/usage/providers:
 *   get:
 *     tags: [Usage]
 *     summary: Provider breakdown (pie/donut chart)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *           maximum: 90
 *     responses:
 *       200:
 *         description: Per-provider request, token, and cost totals
 *
 * /api/usage/latency:
 *   get:
 *     tags: [Usage]
 *     summary: Hourly request distribution (last 7 days)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request counts grouped by hour of day
 *
 * /api/usage/events:
 *   get:
 *     tags: [Usage]
 *     summary: Paginated usage event log
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *     responses:
 *       200:
 *         description: Paginated list of usage events
 *
 * /api/usage/today:
 *   get:
 *     tags: [Usage]
 *     summary: Today's usage vs daily limits
 *     description: Message, voice, and image counts for today against plan-specific limits.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current day usage with limit percentages
 *
 * /api/usage/daily:
 *   get:
 *     tags: [Usage]
 *     summary: Daily usage for last N days
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *           minimum: 1
 *           maximum: 30
 *     responses:
 *       200:
 *         description: Array of daily message and credit totals
 *
 * /api/usage/stats:
 *   get:
 *     tags: [Usage]
 *     summary: Usage stats (alias for /summary)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *     responses:
 *       200:
 *         description: Usage totals
 *
 * /api/usage/history:
 *   get:
 *     tags: [Usage]
 *     summary: Usage history (alias for /events)
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
 *     responses:
 *       200:
 *         description: List of usage events
 *
 * # ── API Keys ───────────────────────────────────────────────
 *
 * /api/api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: List all API keys
 *     description: Returns masked keys for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of API key records (keys are masked)
 *   post:
 *     tags: [API Keys]
 *     summary: Add a new API key
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, key]
 *             properties:
 *               provider:
 *                 type: string
 *               label:
 *                 type: string
 *               key:
 *                 type: string
 *     responses:
 *       201:
 *         description: API key created
 *
 * /api/api-keys/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: Delete an API key
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
 *         description: Key deleted
 *       404:
 *         description: Key not found
 *
 * /api/api-keys/{id}/rotate:
 *   post:
 *     tags: [API Keys]
 *     summary: Rotate an existing API key
 *     description: Replace the stored key value without deleting and re-adding the entry.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key]
 *             properties:
 *               key:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Key rotated successfully
 *       400:
 *         description: Invalid key value
 *       404:
 *         description: API key not found
 *
 * /api/api-keys/{id}/default:
 *   patch:
 *     tags: [API Keys]
 *     summary: Set an API key as default
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
 *         description: Key marked as default
 *
 * # ── Features ───────────────────────────────────────────────
 *
 * /api/features:
 *   get:
 *     tags: [Features]
 *     summary: Get feature flags
 *     description: Returns per-user toggles merged with system-wide feature flags.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Combined feature flags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 socialDiscovery:
 *                   type: boolean
 *                 portfolioChat:
 *                   type: boolean
 *                 automationBuilder:
 *                   type: boolean
 *                 websiteBuilder:
 *                   type: boolean
 *                 n8nIntegration:
 *                   type: boolean
 *                 manyChatIntegration:
 *                   type: boolean
 *                 globalSearch:
 *                   type: boolean
 *                 telegramCommands:
 *                   type: boolean
 *                 smartReminders:
 *                   type: boolean
 *                 createMemory:
 *                   type: boolean
 *                 fileAttachments:
 *                   type: boolean
 *                 videoGeneration:
 *                   type: boolean
 *                 graphMemory:
 *                   type: boolean
 *                 langfuseTracing:
 *                   type: boolean
 *   patch:
 *     tags: [Features]
 *     summary: Update feature flags
 *     description: Toggle per-user feature flags (system flags are read-only).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               socialDiscovery:
 *                 type: boolean
 *               portfolioChat:
 *                 type: boolean
 *               automationBuilder:
 *                 type: boolean
 *               websiteBuilder:
 *                 type: boolean
 *               n8nIntegration:
 *                 type: boolean
 *               manyChatIntegration:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated per-user feature flags
 */
