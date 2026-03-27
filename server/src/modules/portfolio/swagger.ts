// ============================================================
// Portfolio module — Swagger / JSDoc annotations
// ============================================================
//
// These JSDoc blocks document the portfolio endpoints for
// OpenAPI/Swagger tooling. They are not executed at runtime;
// they exist purely as machine-readable API documentation.

/**
 * @swagger
 * /api/portfolio/{username}:
 *   get:
 *     summary: Public portfolio view
 *     description: >
 *       Returns the public portfolio for the given username.
 *       Responses are cached (ETag + Cache-Control). Bot/crawler
 *       user-agents receive an HTML page with Open Graph meta tags
 *       instead of JSON.
 *     tags: [Portfolio]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio owner's username
 *     responses:
 *       200:
 *         description: Portfolio data (JSON) or social preview (HTML for crawlers)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 *       304:
 *         description: Not Modified (ETag match)
 *       404:
 *         description: Portfolio not found
 */

/**
 * @swagger
 * /api/portfolio/me:
 *   get:
 *     summary: Get authenticated user's portfolio
 *     description: >
 *       Returns the full portfolio record for the currently
 *       authenticated user. Response includes private fields and
 *       is served with Cache-Control: private, no-store.
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Owner's full portfolio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Portfolio not found for this user
 */

/**
 * @swagger
 * /api/portfolio/me:
 *   patch:
 *     summary: Update authenticated user's portfolio
 *     description: >
 *       Partially updates the portfolio. Accepts any subset of
 *       editable fields (headline, about, skills, projects, etc.).
 *       Rate-limited to 10 updates per 5 minutes per user.
 *       Invalidates the public portfolio cache on success.
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               headline:
 *                 type: string
 *               about:
 *                 type: string
 *               avatar:
 *                 type: string
 *               location:
 *                 type: string
 *               role:
 *                 type: string
 *               company:
 *                 type: string
 *               layout:
 *                 type: string
 *               metaDescription:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               projects:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/PortfolioProject'
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *               social:
 *                 type: object
 *               visibility:
 *                 type: object
 *               agentEnabled:
 *                 type: boolean
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated portfolio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */

/**
 * @swagger
 * /api/portfolio/me/analytics:
 *   get:
 *     summary: Portfolio visit analytics
 *     description: >
 *       Returns daily visit counts for the authenticated user's
 *       portfolio over the last 30 days, with zero-filled gaps.
 *       Also includes top referrer sources.
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalViews:
 *                   type: integer
 *                 recentViews:
 *                   type: integer
 *                 dailyBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/portfolio/me/ai-edit:
 *   post:
 *     summary: AI-assisted portfolio edit
 *     description: >
 *       Accepts a natural-language prompt and applies AI-generated
 *       enhancements to the portfolio's "about" section. Logs a
 *       usage event and invalidates the public cache.
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: Free-text instruction for the AI enhancement
 *     responses:
 *       200:
 *         description: Updated portfolio after AI edit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Portfolio not found
 */

/**
 * @swagger
 * /api/portfolio/{username}/contact:
 *   post:
 *     summary: Public contact form submission
 *     description: >
 *       Allows anonymous visitors to send a message to the portfolio
 *       owner. Protected by IP-based rate limiting (3 req/hour),
 *       honeypot spam detection, optional nonce validation, and
 *       origin checking. Notifies the owner via Telegram if linked.
 *     tags: [Portfolio]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio owner's username
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [senderName, message]
 *             properties:
 *               senderName:
 *                 type: string
 *               senderEmail:
 *                 type: string
 *                 format: email
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *               honeypot:
 *                 type: string
 *                 description: Hidden field — if filled, request is silently discarded
 *               nonce:
 *                 type: string
 *                 description: One-time token from GET /{username}/contact-nonce
 *     responses:
 *       200:
 *         description: Message accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Validation error (missing fields or invalid email)
 *       403:
 *         description: Origin not allowed
 *       404:
 *         description: User not found or portfolio not public
 *       422:
 *         description: Invalid or expired nonce
 *       429:
 *         description: Rate limit exceeded
 */
