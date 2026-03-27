// ============================================================
// Reminders module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Reminders
 *     description: Reminder CRUD, snooze, recurrence, and bulk operations
 *
 * components:
 *   schemas:
 *     Reminder:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *         text:
 *           type: string
 *         datetime:
 *           type: string
 *           format: date-time
 *         channel:
 *           type: string
 *           enum: [push, telegram, email]
 *         category:
 *           type: string
 *           enum: [personal, work, health, finance, general]
 *         priority:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *         recurring:
 *           type: string
 *         recurrence:
 *           type: string
 *           nullable: true
 *         completed:
 *           type: integer
 *           enum: [0, 1]
 *         completed_at:
 *           type: integer
 *           nullable: true
 *         scheduled_for:
 *           type: integer
 *         snooze_until:
 *           type: integer
 *           nullable: true
 *         snooze_count:
 *           type: integer
 *         created_by:
 *           type: string
 *         created_at:
 *           type: string
 *
 * /reminders:
 *   get:
 *     tags: [Reminders]
 *     summary: List all reminders for the authenticated user
 *     description: Returns reminders ordered by datetime ascending. Supports ETag-based conditional GET (If-None-Match).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of reminders
 *         headers:
 *           ETag:
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reminder'
 *       304:
 *         description: Not modified (ETag matched)
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   post:
 *     tags: [Reminders]
 *     summary: Create a new reminder
 *     description: Creates a reminder and returns it. Includes a duplicate_warning field if a similar reminder already exists.
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
 *               datetime:
 *                 type: string
 *                 format: date-time
 *               channel:
 *                 type: string
 *                 enum: [push, telegram, email]
 *                 default: push
 *               category:
 *                 type: string
 *                 enum: [personal, work, health, finance, general]
 *                 default: general
 *               recurring:
 *                 type: string
 *               recurrence:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *     responses:
 *       201:
 *         description: Created reminder
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Reminder'
 *                 - type: object
 *                   properties:
 *                     duplicate_warning:
 *                       type: string
 *                       nullable: true
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /reminders/{id}:
 *   patch:
 *     tags: [Reminders]
 *     summary: Update a reminder
 *     description: Partially updates the specified reminder. Rescheduling datetime resets the heads-up alert flag.
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
 *               text:
 *                 type: string
 *               datetime:
 *                 type: string
 *                 format: date-time
 *               channel:
 *                 type: string
 *                 enum: [push, telegram, email]
 *               category:
 *                 type: string
 *               recurring:
 *                 type: string
 *               completed:
 *                 type: boolean
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               recurrence:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated reminder
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reminder'
 *       404:
 *         description: Reminder not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   delete:
 *     tags: [Reminders]
 *     summary: Delete a reminder
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
 *         description: Reminder not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /reminders/{id}/snooze:
 *   post:
 *     tags: [Reminders]
 *     summary: Snooze a reminder
 *     description: Snooze using a preset (1h, tomorrow, next-week) or a custom future datetime.
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
 *               preset:
 *                 type: string
 *                 enum: ['1h', 'tomorrow', 'next-week']
 *               customDatetime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Snoozed reminder with new datetime
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reminder'
 *       400:
 *         description: Invalid preset or missing parameters
 *       404:
 *         description: Reminder not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /reminders/bulk:
 *   delete:
 *     tags: [Reminders]
 *     summary: Bulk delete reminders
 *     description: Deletes multiple reminders by ID. Only reminders owned by the authenticated user are deleted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Number of reminders deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: integer
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
