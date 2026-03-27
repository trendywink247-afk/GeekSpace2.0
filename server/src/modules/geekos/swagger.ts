// ============================================================
// GeekOS module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: GeekOS
 *     description: GeekOS bridge — agent CRUD, rooms, memory, plugin fallback
 *   - name: GeekOS LLM
 *     description: OpenAI-compatible LLM proxy for ElizaOS agents
 *   - name: Gate
 *     description: Public REST API for external developers (Bearer agtn_… auth)
 *
 * /api/geekos/status:
 *   get:
 *     tags: [GeekOS]
 *     summary: GeekOS runtime status
 *     description: Check whether the ElizaOS runtime is reachable and how many agents are running.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Runtime status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 geekos:
 *                   type: string
 *                   enum: [running, error, offline]
 *                 agentCount:
 *                   type: number
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       id:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *
 * /api/geekos/agents:
 *   get:
 *     tags: [GeekOS]
 *     summary: List user agents
 *     description: Returns all GeekOS agents owned by the authenticated user with plan limits.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent list with plan info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: object
 *                 plan:
 *                   type: string
 *                 agentLimit:
 *                   oneOf:
 *                     - type: number
 *                     - type: string
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [GeekOS]
 *     summary: Create new agent
 *     description: Creates a new GeekOS agent for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 50
 *               personality_base:
 *                 type: string
 *               system_prompt:
 *                 type: string
 *               plugins:
 *                 type: string
 *     responses:
 *       201:
 *         description: Agent created
 *       400:
 *         description: Validation error or plan limit reached
 *       401:
 *         description: Unauthorized
 *
 * /api/geekos-llm/v1/chat/completions:
 *   post:
 *     tags: [GeekOS LLM]
 *     summary: OpenAI-compatible chat completion
 *     description: >
 *       ElizaOS calls this endpoint as if it were OpenAI.
 *       Internally routes through the Agentin provider waterfall.
 *       Docker-internal only — not exposed via Caddy.
 *     parameters:
 *       - in: header
 *         name: X-Agentin-User-Id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *               max_tokens:
 *                 type: number
 *     responses:
 *       200:
 *         description: Chat completion (OpenAI format)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 object:
 *                   type: string
 *                 model:
 *                   type: string
 *                 choices:
 *                   type: array
 *                   items:
 *                     type: object
 *                 usage:
 *                   type: object
 *       400:
 *         description: Missing header or messages
 *
 * /api/gate/v1/keys:
 *   post:
 *     tags: [Gate]
 *     summary: Create Gate API key
 *     description: Generates a new agtn_… API key for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *     responses:
 *       201:
 *         description: API key created (returned once, cannot be retrieved again)
 *       401:
 *         description: Unauthorized
 *   get:
 *     tags: [Gate]
 *     summary: List Gate API keys
 *     description: Returns metadata for all active API keys (hash only, not the raw key).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *       401:
 *         description: Unauthorized
 *
 * /api/gate/v1/chat:
 *   post:
 *     tags: [Gate]
 *     summary: Chat via Gate API
 *     description: Send a message to the user's default agent via API key auth.
 *     security:
 *       - gateApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               stream:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent reply
 *       401:
 *         description: Invalid or missing API key
 *       429:
 *         description: Rate limit exceeded (60 req/min per key)
 */
