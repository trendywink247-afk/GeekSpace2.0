// ============================================================
// Automation module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Automations
 *     description: Automation CRUD, triggers, webhooks, dry-run, duplicate, and dead-letters
 *   - name: Workflows
 *     description: Multi-step workflow CRUD and execution runs
 *   - name: Planner
 *     description: Daily time-block planner with weekly views
 *   - name: Jobs
 *     description: Async job status polling
 *   - name: Proactive
 *     description: Proactive message settings and logs
 *
 * components:
 *   schemas:
 *     Automation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         trigger_type:
 *           type: string
 *           enum: [manual, webhook, schedule, event]
 *         trigger_config:
 *           type: string
 *         action_type:
 *           type: string
 *         action_config:
 *           type: string
 *         enabled:
 *           type: boolean
 *         created_at:
 *           type: string
 *
 *     AutomationStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         enabled:
 *           type: integer
 *         disabled:
 *           type: integer
 *         byTrigger:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               trigger_type:
 *                 type: string
 *               cnt:
 *                 type: integer
 *         recentRuns:
 *           type: integer
 *
 *     DryRunResponse:
 *       type: object
 *       properties:
 *         dryRun:
 *           type: boolean
 *         automationId:
 *           type: string
 *         automationName:
 *           type: string
 *         triggerType:
 *           type: string
 *         triggerConfig:
 *           type: object
 *         actionType:
 *           type: string
 *         simulatedOutput:
 *           type: string
 *         enabled:
 *           type: boolean
 *
 *     WebhookTestResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         statusCode:
 *           type: integer
 *         message:
 *           type: string
 *         latencyMs:
 *           type: number
 *         contentType:
 *           type: string
 *         responseBody:
 *           type: string
 *
 *     DeadLetterEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         automation_id:
 *           type: string
 *         url:
 *           type: string
 *         error:
 *           type: string
 *         payload:
 *           type: string
 *           nullable: true
 *         failed_at:
 *           type: integer
 *         retry_count:
 *           type: integer
 *         last_error:
 *           type: string
 *           nullable: true
 *
 *     Workflow:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         user_id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         steps:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               config:
 *                 type: object
 *         trigger:
 *           type: string
 *         enabled:
 *           type: boolean
 *         last_run:
 *           type: integer
 *           nullable: true
 *         created_at:
 *           type: integer
 *
 *     PlannerBlock:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         title:
 *           type: string
 *         duration:
 *           type: integer
 *         color:
 *           type: string
 *         category:
 *           type: string
 *         completed:
 *           type: integer
 *           enum: [0, 1]
 *         sort_order:
 *           type: integer
 *         source:
 *           type: string
 *         source_id:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *         updated_at:
 *           type: string
 *           nullable: true
 *
 *     JobStatus:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, processing, done, failed]
 *         result:
 *           type: object
 *           nullable: true
 *         error:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: integer
 *         updatedAt:
 *           type: integer
 *
 *     ProactiveSettings:
 *       type: object
 *       properties:
 *         enabled:
 *           type: boolean
 *         autonomy_level:
 *           type: string
 *           enum: [manual, assisted, proactive, autonomous]
 *         quiet_start:
 *           type: string
 *           example: "22:00"
 *         quiet_end:
 *           type: string
 *           example: "07:00"
 *
 * /automations/stats:
 *   get:
 *     tags: [Automations]
 *     summary: Get automation summary statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats including total, enabled, disabled counts and recent runs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AutomationStats'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations:
 *   get:
 *     tags: [Automations]
 *     summary: List automations for the authenticated user
 *     description: Supports optional enabled filter and per-user Redis caching (30s TTL).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter by enabled state
 *     responses:
 *       200:
 *         description: Array of automations
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Automation'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   post:
 *     tags: [Automations]
 *     summary: Create a new automation
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
 *               description:
 *                 type: string
 *               triggerType:
 *                 type: string
 *                 enum: [manual, webhook, schedule, event]
 *                 default: manual
 *               triggerConfig:
 *                 type: object
 *               actionType:
 *                 type: string
 *               actionConfig:
 *                 type: object
 *     responses:
 *       201:
 *         description: Created automation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Automation'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/{id}:
 *   patch:
 *     tags: [Automations]
 *     summary: Update an automation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               triggerType:
 *                 type: string
 *               triggerConfig:
 *                 type: object
 *               actionType:
 *                 type: string
 *               actionConfig:
 *                 type: object
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated automation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Automation'
 *       404:
 *         description: Automation not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   delete:
 *     tags: [Automations]
 *     summary: Delete an automation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Automation not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/{id}/trigger:
 *   post:
 *     tags: [Automations]
 *     summary: Manually trigger an automation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Trigger result
 *       404:
 *         description: Automation not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/{id}/dry-run:
 *   post:
 *     tags: [Automations]
 *     summary: Simulate an automation without executing
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Simulated output
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DryRunResponse'
 *       404:
 *         description: Automation not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/{id}/duplicate:
 *   post:
 *     tags: [Automations]
 *     summary: Duplicate an existing automation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Duplicated automation (disabled by default)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Automation'
 *       404:
 *         description: Automation not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/{id}/test:
 *   post:
 *     tags: [Automations]
 *     summary: Test-fire a webhook automation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Webhook test result with latency and response body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookTestResponse'
 *       400:
 *         description: No URL configured or invalid URL
 *       404:
 *         description: Automation not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/logs:
 *   get:
 *     tags: [Automations]
 *     summary: List execution logs for all automations
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, failed, error]
 *     responses:
 *       200:
 *         description: Paginated execution logs
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/{id}/logs:
 *   get:
 *     tags: [Automations]
 *     summary: List execution logs for a specific automation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, failed, error]
 *     responses:
 *       200:
 *         description: Paginated execution logs for the automation
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/dead-letters:
 *   get:
 *     tags: [Automations]
 *     summary: List webhook dead-letter entries
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Last 20 dead-letter entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DeadLetterEntry'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/dead-letters/{id}/retry:
 *   post:
 *     tags: [Automations]
 *     summary: Retry a dead-letter webhook
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
 *         description: Retry result; removed if successful
 *       404:
 *         description: Dead-letter entry not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /automations/webhook/{id}:
 *   post:
 *     tags: [Automations]
 *     summary: Receive an external webhook trigger (no auth)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Payload must be a JSON object
 *       404:
 *         description: Automation not found
 *
 * /workflows:
 *   get:
 *     tags: [Workflows]
 *     summary: List user workflows
 *     description: Seeds default workflow templates on first access.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of workflows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Workflow'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   post:
 *     tags: [Workflows]
 *     summary: Create a new workflow
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, steps]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                     config:
 *                       type: object
 *               trigger:
 *                 type: string
 *                 default: manual
 *     responses:
 *       201:
 *         description: Created workflow
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workflow'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /workflows/runs/{runId}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get a single workflow run by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Workflow run details
 *       400:
 *         description: Invalid run ID
 *       404:
 *         description: Run not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /workflows/{id}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get a single workflow
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
 *         description: Workflow details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workflow'
 *       404:
 *         description: Workflow not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   patch:
 *     tags: [Workflows]
 *     summary: Update a workflow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *               trigger:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated workflow
 *       400:
 *         description: No fields to update
 *       404:
 *         description: Workflow not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   delete:
 *     tags: [Workflows]
 *     summary: Delete a workflow
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
 *         description: Deleted successfully
 *       404:
 *         description: Workflow not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /workflows/{id}/run:
 *   post:
 *     tags: [Workflows]
 *     summary: Trigger a workflow run (non-blocking)
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
 *               input:
 *                 type: string
 *     responses:
 *       200:
 *         description: Run started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 runId:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   enum: [running]
 *       400:
 *         description: Workflow execution failed
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /workflows/{id}/runs:
 *   get:
 *     tags: [Workflows]
 *     summary: List recent runs for a workflow
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
 *         description: Array of recent runs (max 10)
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /planner/week/{date}:
 *   get:
 *     tags: [Planner]
 *     summary: Get 7 days of planner blocks starting from date
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Blocks grouped by date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blocks:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/PlannerBlock'
 *       400:
 *         description: Invalid date format
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /planner/{date}:
 *   get:
 *     tags: [Planner]
 *     summary: Get planner blocks for a specific date
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Blocks for the date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blocks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlannerBlock'
 *       400:
 *         description: Invalid date format
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /planner:
 *   post:
 *     tags: [Planner]
 *     summary: Create a new planner block
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, date]
 *             properties:
 *               title:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               duration:
 *                 type: integer
 *                 default: 30
 *               color:
 *                 type: string
 *                 default: '#00F0FF'
 *               category:
 *                 type: string
 *                 default: work
 *               completed:
 *                 type: integer
 *                 enum: [0, 1]
 *                 default: 0
 *               sort_order:
 *                 type: integer
 *                 default: 0
 *               source:
 *                 type: string
 *                 default: manual
 *               source_id:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Created block
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 block:
 *                   $ref: '#/components/schemas/PlannerBlock'
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /planner/{id}:
 *   patch:
 *     tags: [Planner]
 *     summary: Update a planner block
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               duration:
 *                 type: integer
 *               color:
 *                 type: string
 *               category:
 *                 type: string
 *               completed:
 *                 type: integer
 *                 enum: [0, 1]
 *               sort_order:
 *                 type: integer
 *               source:
 *                 type: string
 *               source_id:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated block
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 block:
 *                   $ref: '#/components/schemas/PlannerBlock'
 *       400:
 *         description: Invalid input or no fields to update
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Block not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   delete:
 *     tags: [Planner]
 *     summary: Delete a planner block
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Block not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /jobs/{id}:
 *   get:
 *     tags: [Jobs]
 *     summary: Poll async job status
 *     description: Returns job status and result/error when complete. Users can only poll their own jobs.
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
 *         description: Job status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobStatus'
 *       404:
 *         description: Job not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /proactive/log:
 *   get:
 *     tags: [Proactive]
 *     summary: Get proactive message log
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Array of proactive log entries
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /proactive/settings:
 *   get:
 *     tags: [Proactive]
 *     summary: Get proactive settings and autonomy level
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Proactive settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProactiveSettings'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   patch:
 *     tags: [Proactive]
 *     summary: Update autonomy level and quiet hours
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               autonomy_level:
 *                 type: string
 *                 enum: [manual, assisted, proactive, autonomous]
 *               quiet_start:
 *                 type: string
 *                 example: "22:00"
 *               quiet_end:
 *                 type: string
 *                 example: "07:00"
 *     responses:
 *       200:
 *         description: Settings updated
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /proactive/toggle:
 *   patch:
 *     tags: [Proactive]
 *     summary: Enable or disable proactive messages
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Toggle state updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *       400:
 *         description: enabled must be a boolean
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
