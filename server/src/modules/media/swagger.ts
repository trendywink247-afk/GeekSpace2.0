// ============================================================
// Media module — Swagger / JSDoc annotations
//
// These are JSDoc-style OpenAPI annotations for future Swagger
// generation. They document the media endpoints without
// affecting runtime behaviour.
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Images
 *     description: AI image generation and gallery management
 *   - name: Videos
 *     description: AI video generation and gallery management
 *   - name: Voice
 *     description: Speech-to-text and text-to-speech
 */

// ── Images ──────────────────────────────────────────────────

/**
 * @swagger
 * /api/images:
 *   get:
 *     summary: List user images
 *     description: Returns all non-expired images for the authenticated user (max 10, 24h TTL).
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Image gallery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GeneratedImage'
 *                 count:
 *                   type: integer
 *                 max:
 *                   type: integer
 *                   example: 10
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/images/generate:
 *   post:
 *     summary: Generate an image
 *     description: >
 *       Generates an AI image via Pollinations (free) or OpenRouter (premium).
 *       Enforces per-user gallery cap (10 images) and daily generation limits.
 *     tags: [Images]
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
 *                 example: "A cyberpunk city at sunset"
 *               model:
 *                 type: string
 *                 enum: [auto, pollinations, huggingface, openrouter-image]
 *                 default: auto
 *               width:
 *                 type: integer
 *                 default: 1024
 *               height:
 *                 type: integer
 *                 default: 1024
 *               seed:
 *                 type: integer
 *               enhance:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Image generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageGenerateResponse'
 *       429:
 *         description: Gallery full or daily cap reached
 *       401:
 *         description: Unauthorized
 */

// ── Videos ──────────────────────────────────────────────────

/**
 * @swagger
 * /api/videos:
 *   get:
 *     summary: List user videos
 *     description: Returns all non-expired videos for the authenticated user (max 5, 24h TTL).
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Video gallery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 videos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GeneratedVideo'
 *                 count:
 *                   type: integer
 *                 max:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/videos/generate:
 *   post:
 *     summary: Generate a video
 *     description: >
 *       Generates an AI video via Pollinations, Director Mode, or OpenRouter.
 *       Videos take 30-120s to generate. Enforces per-user gallery cap (5 videos).
 *     tags: [Videos]
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
 *                 example: "A rocket launch in slow motion"
 *               model:
 *                 type: string
 *                 enum: [auto, pollinations-video, seedance-lite, openrouter-video, fal-minimax]
 *                 default: auto
 *               width:
 *                 type: integer
 *               height:
 *                 type: integer
 *               duration:
 *                 type: integer
 *                 description: Duration in seconds
 *     responses:
 *       200:
 *         description: Video generated or queued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoGenerateResponse'
 *       429:
 *         description: Gallery full or daily cap reached
 *       401:
 *         description: Unauthorized
 */

// ── Voice ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/voice/transcribe:
 *   post:
 *     summary: Speech to text
 *     description: >
 *       Accepts raw audio (webm/ogg/mp4) and enqueues a transcription job.
 *       Enforces daily voice cap per plan tier. Poll result via GET /api/jobs/:id.
 *     tags: [Voice]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         audio/webm:
 *           schema:
 *             type: string
 *             format: binary
 *         audio/ogg:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       202:
 *         description: Transcription job enqueued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *       429:
 *         description: Daily voice cap reached
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/voice/tts:
 *   post:
 *     summary: Text to speech
 *     description: >
 *       Accepts {text, voice?} and enqueues a TTS synthesis job.
 *       Enforces daily voice cap per plan tier. Poll result via GET /api/jobs/:id.
 *     tags: [Voice]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Hello, welcome to GeekSpace!"
 *               voice:
 *                 type: string
 *                 description: Voice ID for synthesis
 *     responses:
 *       202:
 *         description: TTS job enqueued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *       429:
 *         description: Daily voice cap reached
 *       401:
 *         description: Unauthorized
 */

// ── Shared Schemas ──────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     GeneratedImage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         prompt:
 *           type: string
 *         model:
 *           type: string
 *         imageUrl:
 *           type: string
 *           format: uri
 *         width:
 *           type: integer
 *         height:
 *           type: integer
 *         source:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 *
 *     ImageGenerateResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         imageUrl:
 *           type: string
 *           format: uri
 *         prompt:
 *           type: string
 *         model:
 *           type: string
 *         width:
 *           type: integer
 *         height:
 *           type: integer
 *         source:
 *           type: string
 *         expiresAt:
 *           type: string
 *           format: date-time
 *
 *     GeneratedVideo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         prompt:
 *           type: string
 *         model:
 *           type: string
 *         videoUrl:
 *           type: string
 *           format: uri
 *         width:
 *           type: integer
 *         height:
 *           type: integer
 *         duration:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         source:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 *
 *     VideoGenerateResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         videoUrl:
 *           type: string
 *           format: uri
 *         prompt:
 *           type: string
 *         model:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         expiresAt:
 *           type: string
 *           format: date-time
 */
