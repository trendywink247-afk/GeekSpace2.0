// ============================================================
// Agent module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Agent
 *     description: LLM chat, agent fleet, workflows, and agent communication
 *
 * /agent/chat:
 *   post:
 *     tags: [Agent]
 *     summary: Send message to agent
 *     description: Sends a message to the LLM agent and returns the response. Supports streaming via SSE.
 *     security:
 *       - bearerAuth: []
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
 *               conversationId:
 *                 type: string
 *               model:
 *                 type: string
 *               stream:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent reply
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *                 conversationId:
 *                   type: string
 *                 model:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 creditsUsed:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *
 * /agent/chat/conversations:
 *   get:
 *     tags: [Agent]
 *     summary: List user conversations
 *     description: Returns a list of all conversations for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
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
 *                   created_at:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *
 * /agent/chat/conversations/{id}:
 *   get:
 *     tags: [Agent]
 *     summary: Get conversation messages
 *     description: Returns all messages in a specific conversation.
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
 *         description: Conversation messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   role:
 *                     type: string
 *                     enum: [user, assistant, system]
 *                   content:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 *   delete:
 *     tags: [Agent]
 *     summary: Delete conversation
 *     description: Deletes a specific conversation and all its messages.
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
 *         description: Conversation deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 *
 * /agent/config:
 *   get:
 *     tags: [Agent]
 *     summary: Get agent config
 *     description: Returns the current agent configuration for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 personality:
 *                   type: string
 *                 temperature:
 *                   type: number
 *                 model:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 system_prompt:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *   put:
 *     tags: [Agent]
 *     summary: Update agent config
 *     description: Updates the agent configuration for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               personality:
 *                 type: string
 *               temperature:
 *                 type: number
 *               model:
 *                 type: string
 *               provider:
 *                 type: string
 *               system_prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated agent configuration
 *       401:
 *         description: Unauthorized
 *
 * /agent/memory:
 *   get:
 *     tags: [Agent]
 *     summary: Get agent memory entries
 *     description: Returns stored memory entries for the authenticated user's agent.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of memory entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   content:
 *                     type: string
 *                   created_at:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [Agent]
 *     summary: Add memory entry
 *     description: Adds a new memory entry for the authenticated user's agent.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Memory entry created
 *       401:
 *         description: Unauthorized
 *
 * /agent/workflows:
 *   get:
 *     tags: [Agent]
 *     summary: Get workflow status
 *     description: Returns the status of all workflows for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workflow statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [active, paused, completed]
 *                   steps_completed:
 *                     type: number
 *                   total_steps:
 *                     type: number
 *       401:
 *         description: Unauthorized
 *
 * /agent-state:
 *   get:
 *     tags: [Agent]
 *     summary: SSE stream of agent states
 *     description: Opens an SSE connection that streams real-time agent state updates.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE event stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *
 * /agent-tasks:
 *   get:
 *     tags: [Agent]
 *     summary: List agent tasks
 *     description: Returns all tasks for the authenticated user's agents.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of agent tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   agent_id:
 *                     type: string
 *                   description:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [queued, running, done, failed]
 *                   result:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                   completed_at:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [Agent]
 *     summary: Create agent task
 *     description: Creates a new task and assigns it to an agent.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agent_id, description]
 *             properties:
 *               agent_id:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task created
 *       401:
 *         description: Unauthorized
 *
 * /agent-comms:
 *   get:
 *     tags: [Agent]
 *     summary: List agent communications
 *     description: Returns inter-agent communications for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of agent communications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   from_agent:
 *                     type: string
 *                   to_agent:
 *                     type: string
 *                   message:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [delegation, response, broadcast]
 *                   acknowledged:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [Agent]
 *     summary: Send agent communication
 *     description: Sends an inter-agent communication message.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from_agent, to_agent, message, type]
 *             properties:
 *               from_agent:
 *                 type: string
 *               to_agent:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [delegation, response, broadcast]
 *     responses:
 *       201:
 *         description: Communication sent
 *       401:
 *         description: Unauthorized
 */
