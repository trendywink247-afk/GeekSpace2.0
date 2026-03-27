// ============================================================
// Focus module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Focus
 *     description: Focus session management, deferred messages, and notification settings
 *   - name: Habits
 *     description: Habit tracking, logging, and statistics
 *
 * components:
 *   schemas:
 *     FocusSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         user_id:
 *           type: string
 *         goal:
 *           type: string
 *           nullable: true
 *         duration_min:
 *           type: integer
 *           nullable: true
 *         started_at:
 *           type: string
 *           format: date-time
 *         ended_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         completed:
 *           type: boolean
 *
 *     FocusSummary:
 *       type: object
 *       properties:
 *         total_sessions:
 *           type: integer
 *         completed_sessions:
 *           type: integer
 *         total_minutes:
 *           type: number
 *         average_duration_min:
 *           type: number
 *
 *     DeferredMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         user_id:
 *           type: string
 *         content:
 *           type: string
 *         source:
 *           type: string
 *         received_at:
 *           type: string
 *           format: date-time
 *
 *     NotificationSettings:
 *       type: object
 *       properties:
 *         dnd_start:
 *           type: string
 *           nullable: true
 *         dnd_end:
 *           type: string
 *           nullable: true
 *         urgent_bypass:
 *           type: boolean
 *         batch_interval_min:
 *           type: integer
 *         focus_mode_active:
 *           type: boolean
 *
 *     Habit:
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
 *           nullable: true
 *         frequency:
 *           type: string
 *           enum: [daily, weekly, monthly, weekdays]
 *         target_time:
 *           type: string
 *           nullable: true
 *         icon:
 *           type: string
 *           nullable: true
 *         current_streak:
 *           type: integer
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     HabitLog:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         habit_id:
 *           type: integer
 *         user_id:
 *           type: string
 *         note:
 *           type: string
 *           nullable: true
 *         logged_at:
 *           type: string
 *           format: date-time
 *
 *     HabitStats:
 *       type: object
 *       properties:
 *         habit_id:
 *           type: integer
 *         total_logs:
 *           type: integer
 *         current_streak:
 *           type: integer
 *         longest_streak:
 *           type: integer
 *         completion_rate:
 *           type: number
 *
 * /focus/active:
 *   get:
 *     tags: [Focus]
 *     summary: Get the active focus session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current active session or null
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/FocusSession'
 *                   nullable: true
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /focus/start:
 *   post:
 *     tags: [Focus]
 *     summary: Start a new focus session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               goal:
 *                 type: string
 *                 maxLength: 200
 *               durationMin:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *     responses:
 *       201:
 *         description: Focus session started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/FocusSession'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /focus/end:
 *   post:
 *     tags: [Focus]
 *     summary: End the active focus session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completed:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Ended session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/FocusSession'
 *       404:
 *         description: No active focus session
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /focus/history:
 *   get:
 *     tags: [Focus]
 *     summary: Get focus session history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Array of past focus sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FocusSession'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /focus/summary:
 *   get:
 *     tags: [Focus]
 *     summary: Get aggregate focus statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Focus summary statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   $ref: '#/components/schemas/FocusSummary'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /focus/deferred:
 *   get:
 *     tags: [Focus]
 *     summary: Get messages deferred during focus mode
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deferred messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeferredMessage'
 *                 count:
 *                   type: integer
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /focus/settings:
 *   get:
 *     tags: [Focus]
 *     summary: Get notification settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current notification settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   patch:
 *     tags: [Focus]
 *     summary: Update notification settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dnd_start:
 *                 type: string
 *               dnd_end:
 *                 type: string
 *               urgent_bypass:
 *                 type: boolean
 *               batch_interval_min:
 *                 type: integer
 *               focus_mode_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated notification settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /habits:
 *   get:
 *     tags: [Habits]
 *     summary: List all habits for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of habits
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habits:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Habit'
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 *   post:
 *     tags: [Habits]
 *     summary: Create a new habit
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
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly, weekdays]
 *                 default: daily
 *               targetTime:
 *                 type: string
 *               icon:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Created habit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit:
 *                   $ref: '#/components/schemas/Habit'
 *       400:
 *         description: Validation error (name required or too long)
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /habits/{id}:
 *   delete:
 *     tags: [Habits]
 *     summary: Delete a habit
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid id
 *       404:
 *         description: Habit not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /habits/{id}/log:
 *   post:
 *     tags: [Habits]
 *     summary: Log a habit completion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Logged habit entry with current streak
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 log:
 *                   $ref: '#/components/schemas/HabitLog'
 *                 streak:
 *                   type: integer
 *       400:
 *         description: Invalid id or logging failed
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /habits/{id}/stats:
 *   get:
 *     tags: [Habits]
 *     summary: Get statistics for a habit
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
 *         description: Habit statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   $ref: '#/components/schemas/HabitStats'
 *       400:
 *         description: Invalid id
 *       404:
 *         description: Habit not found
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
