// ============================================================
// Office module — Swagger / JSDoc annotations
//
// These are JSDoc-style OpenAPI annotations for future Swagger
// generation. They document the office/productivity endpoints
// without affecting runtime behaviour.
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Office
 *     description: Unified office dashboard state
 *   - name: Docs
 *     description: Personal knowledge workspace (CRUD, folders, search)
 *   - name: Files
 *     description: File upload, listing, serving, and deletion
 *   - name: Sandbox
 *     description: Cloud dev environments per user
 *   - name: Skills
 *     description: Skill marketplace — install, uninstall, configure
 *   - name: LogoAI
 *     description: AI-powered logo generation and brand kit
 */

// ── Office ──────────────────────────────────────────────────

/**
 * @swagger
 * /api/office/state:
 *   get:
 *     summary: Get full office state
 *     description: Returns tasks, comms, agent states, events, and delegation status in a single call.
 *     tags: [Office]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated office state
 */

// ── Docs ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: List documents
 *     description: Returns all documents for the authenticated user.
 *     tags: [Docs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of documents
 *   post:
 *     summary: Create a document
 *     tags: [Docs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created document
 */

// ── Files ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: List uploaded files
 *     description: Returns all files belonging to the authenticated user.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of file metadata
 *   post:
 *     summary: Upload a file
 *     description: Accepts images, PDFs, plain text, markdown, and CSV.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Uploaded file metadata
 */

// ── Sandbox ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/sandbox:
 *   get:
 *     summary: List sandboxes
 *     description: Returns sandbox environments for the authenticated user.
 *     tags: [Sandbox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of sandbox info
 *   post:
 *     summary: Create a sandbox
 *     tags: [Sandbox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created sandbox
 */

// ── Skills ──────────────────────────────────────────────────

/**
 * @swagger
 * /api/skills:
 *   get:
 *     summary: List available skills
 *     description: Returns all marketplace skills with install status.
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of skills
 */

// ── Logo AI ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/logo/ai-visual:
 *   post:
 *     summary: Generate logo image
 *     description: Uses Together AI FLUX to generate a logo from a prompt.
 *     tags: [LogoAI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *               category:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generated logo result
 */
