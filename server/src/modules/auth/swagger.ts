// ============================================================
// Auth module Swagger documentation
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication, sessions, and password management
 *   - name: OAuth
 *     description: Third-party OAuth provider callbacks
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: Authenticates a user and returns JWT access and refresh tokens.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                 expiresIn:
 *                   type: number
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 *
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account
 *     description: Registers a new user with email and password.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               inviteCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *       409:
 *         description: Email already in use
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and revoke tokens
 *     description: Revokes the current refresh token and invalidates the session.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         $ref: '#/components/schemas/Error'
 *
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Exchanges a valid refresh token for a new access token (token rotation).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *       401:
 *         description: Invalid or expired refresh token
 *
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: Sends a password reset OTP to the user's email or phone.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               channel:
 *                 type: string
 *                 enum: [email, sms]
 *     responses:
 *       200:
 *         description: Reset OTP sent (always returns 200 to prevent email enumeration)
 *       429:
 *         description: Too many reset requests
 *
 * /oauth/google/callback:
 *   get:
 *     tags: [OAuth]
 *     summary: Google OAuth callback
 *     description: Handles the redirect from Google OAuth. Exchanges the authorization code for tokens and creates or links the user account.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: CSRF state parameter
 *     responses:
 *       302:
 *         description: Redirects to frontend with auth tokens
 *       401:
 *         description: OAuth authentication failed
 *
 * /oauth/github/callback:
 *   get:
 *     tags: [OAuth]
 *     summary: GitHub OAuth callback
 *     description: Handles the redirect from GitHub OAuth. Exchanges the authorization code for tokens and creates or links the user account.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from GitHub
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: CSRF state parameter
 *     responses:
 *       302:
 *         description: Redirects to frontend with auth tokens
 *       401:
 *         description: OAuth authentication failed
 */
