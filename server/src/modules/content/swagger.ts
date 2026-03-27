// ============================================================
// Content module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Content
 *     description: Artifacts and templates management
 *
 * /artifacts:
 *   get:
 *     tags: [Content]
 *     summary: List artifacts
 *     description: Returns all artifacts owned by the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of artifacts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   type:
 *                     type: string
 *                   is_public:
 *                     type: boolean
 *                   view_count:
 *                     type: number
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Content]
 *     summary: Create artifact
 *     description: Creates a new artifact for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, type]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Artifact created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 type:
 *                   type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /artifacts/{id}:
 *   get:
 *     tags: [Content]
 *     summary: Get artifact
 *     description: Returns a single artifact by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Artifact details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 type:
 *                   type: string
 *                 is_public:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Artifact not found
 *
 * /artifacts/{id}/deploy:
 *   post:
 *     tags: [Content]
 *     summary: Deploy artifact
 *     description: Deploys an artifact, making it publicly accessible at a generated URL.
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
 *         description: Artifact deployed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [pending, active, failed]
 *       401:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         description: Artifact not found
 *
 * /templates:
 *   get:
 *     tags: [Content]
 *     summary: List templates
 *     description: Returns all available templates, optionally filtered by category.
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category slug
 *     responses:
 *       200:
 *         description: List of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   category:
 *                     type: string
 *                   is_official:
 *                     type: boolean
 *                   use_count:
 *                     type: number
 *
 * /templates/official:
 *   get:
 *     tags: [Content]
 *     summary: List official templates
 *     description: Returns only official/curated templates.
 *     responses:
 *       200:
 *         description: List of official templates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   category:
 *                     type: string
 *                   thumbnail_url:
 *                     type: string
 *                     nullable: true
 *
 * /templates/{id}:
 *   get:
 *     tags: [Content]
 *     summary: Get template
 *     description: Returns a single template by ID with its full content.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                   nullable: true
 *                 content:
 *                   type: string
 *                 category:
 *                   type: string
 *                 is_official:
 *                   type: boolean
 *       404:
 *         description: Template not found
 */
