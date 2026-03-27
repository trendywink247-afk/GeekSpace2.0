// ============================================================
// Comms module — Swagger / JSDoc annotations
// ============================================================
//
// These JSDoc blocks document the comms endpoints (briefings,
// suggestions, recipes) for OpenAPI/Swagger tooling. They are
// not executed at runtime; they exist purely as machine-readable
// API docs.

// ── Briefings ────────────────────────────────────────────────

/**
 * @swagger
 * /api/briefings:
 *   get:
 *     summary: List recent briefings
 *     description: >
 *       Returns the most recent daily briefings for the authenticated
 *       user. Supports an optional `limit` query parameter (max 50,
 *       default 10).
 *     tags: [Briefings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Maximum number of briefings to return
 *     responses:
 *       200:
 *         description: List of briefings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Briefing'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/briefings/trigger:
 *   post:
 *     summary: Trigger a new briefing
 *     description: >
 *       Generates a new daily briefing on demand for the authenticated
 *       user and returns its content.
 *     tags: [Briefings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Generated briefing content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BriefingTriggerResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to generate briefing
 */

// ── Suggestions ──────────────────────────────────────────────

/**
 * @swagger
 * /api/suggestions:
 *   post:
 *     summary: Create a new suggestion
 *     description: >
 *       Submits a user suggestion. Title (1-100 chars) and body
 *       (20-2000 chars) are required. Up to 5 optional tags.
 *       Rate-limited to 5 per user per hour and 20 total per user.
 *       Returns a duplicate warning if a near-duplicate is detected.
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SuggestionCreateBody'
 *     responses:
 *       201:
 *         description: Suggestion created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Suggestion'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */

/**
 * @swagger
 * /api/suggestions/mine:
 *   get:
 *     summary: List own suggestions (paginated)
 *     description: >
 *       Returns the authenticated user's suggestions with pagination.
 *       Supports `page` and `limit` query parameters (max 50 per page).
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Paginated suggestion list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuggestionListResponse'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/suggestions/clusters:
 *   get:
 *     summary: List suggestion clusters with scores
 *     description: >
 *       Returns all suggestion clusters with demand, impact, effort,
 *       risk, and overall scores. Includes aggregate vote counts.
 *       Results are cached for 30 seconds.
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cluster list with scores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuggestionClusterListResponse'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/suggestions/rewards/mine:
 *   get:
 *     summary: User reward ledger
 *     description: >
 *       Returns the authenticated user's reward entries earned
 *       from suggestion activity.
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reward ledger
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RewardListResponse'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/suggestions/{id}:
 *   get:
 *     summary: Get own suggestion by ID
 *     description: >
 *       Returns a single suggestion by ID. Only accessible by the
 *       suggestion's author.
 *     tags: [Suggestions]
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
 *         description: Suggestion detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Suggestion'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Suggestion not found
 *   patch:
 *     summary: Edit own suggestion
 *     description: >
 *       Updates the title and body of a suggestion. Only allowed
 *       when the suggestion is in "new" status.
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SuggestionEditBody'
 *     responses:
 *       200:
 *         description: Updated suggestion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Suggestion'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Suggestion not found
 *       409:
 *         description: Suggestion is not in "new" status
 *   delete:
 *     summary: Soft-delete own suggestion
 *     description: >
 *       Soft-deletes a suggestion by setting its deleted_at timestamp.
 *       Only allowed when the suggestion is in "new" status. Also
 *       cleans up orphaned votes.
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Suggestion deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Suggestion not found
 *       409:
 *         description: Suggestion is not in "new" status
 */

/**
 * @swagger
 * /api/suggestions/{id}/vote:
 *   post:
 *     summary: Vote on a suggestion
 *     description: >
 *       Casts a vote (1 for upvote, -1 for downvote) on a suggestion.
 *       Replaces any existing vote by the same user. Rate-limited to
 *       10 votes per user per minute.
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SuggestionVoteBody'
 *     responses:
 *       200:
 *         description: Updated vote counts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuggestionVoteResponse'
 *       400:
 *         description: Invalid vote value
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Suggestion not found
 *       429:
 *         description: Vote rate limit exceeded
 */

/**
 * @swagger
 * /api/suggestions/{id}/events:
 *   get:
 *     summary: Status history for own suggestion
 *     description: >
 *       Returns the status-change event log for a suggestion owned
 *       by the authenticated user, ordered chronologically.
 *     tags: [Suggestions]
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
 *         description: Event history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuggestionEventListResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Suggestion not found
 */

// ── Recipes ──────────────────────────────────────────────────

/**
 * @swagger
 * /api/recipes:
 *   get:
 *     summary: List all recipes
 *     description: >
 *       Returns all available recipes with each recipe's installation
 *       status for the authenticated user.
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recipe list with install status
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RecipeListItem'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/recipes/{id}/install:
 *   post:
 *     summary: Install a recipe
 *     description: >
 *       Installs a recipe for the authenticated user with an optional
 *       configuration object.
 *     tags: [Recipes]
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
 *             $ref: '#/components/schemas/RecipeInstallBody'
 *     responses:
 *       200:
 *         description: Recipe installed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: Install failed
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/recipes/{id}/uninstall:
 *   delete:
 *     summary: Uninstall a recipe
 *     description: >
 *       Removes a previously installed recipe for the authenticated user.
 *     tags: [Recipes]
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
 *         description: Recipe uninstalled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: Uninstall failed
 *       401:
 *         description: Unauthorized
 */
