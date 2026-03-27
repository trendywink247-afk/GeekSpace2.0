// ============================================================
// Billing module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Billing
 *     description: Plans, subscriptions, credits, and payment processing
 *
 * /billing/plans:
 *   get:
 *     tags: [Billing]
 *     summary: List available plans
 *     description: Returns all available subscription plans with pricing and feature details.
 *     security: []
 *     responses:
 *       200:
 *         description: List of plans
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
 *                   tier:
 *                     type: string
 *                     enum: [free, starter, pro, enterprise]
 *                   priceMonthly:
 *                     type: number
 *                   priceYearly:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   features:
 *                     type: array
 *                     items:
 *                       type: string
 *                   creditsPerMonth:
 *                     type: number
 *
 * /billing/upgrade:
 *   post:
 *     tags: [Billing]
 *     summary: Upgrade subscription plan
 *     description: Upgrades the authenticated user's subscription to a new plan tier.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId:
 *                 type: string
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *     responses:
 *       200:
 *         description: Subscription upgraded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscription:
 *                   type: object
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *       402:
 *         description: Payment required
 *
 * /billing/checkout:
 *   post:
 *     tags: [Billing]
 *     summary: Create checkout session
 *     description: Creates a Stripe checkout session for plan purchase or day pass.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [priceId]
 *             properties:
 *               priceId:
 *                 type: string
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 url:
 *                   type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /billing/stripe/webhook:
 *   post:
 *     tags: [Billing]
 *     summary: Stripe webhook handler
 *     description: Receives and processes Stripe webhook events (checkout.session.completed, invoice.paid, etc.).
 *     security: []
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
 *         description: Invalid webhook signature
 *
 * /billing/credits:
 *   get:
 *     tags: [Billing]
 *     summary: Get credit balance
 *     description: Returns the authenticated user's current credit balance and reset date.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current credit balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 remaining:
 *                   type: number
 *                 total:
 *                   type: number
 *                 resetDate:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
