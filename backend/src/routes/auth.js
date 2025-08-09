const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');
const { loginRateLimiter } = require('../middleware/security');
const { getAuthUrl, getUserFromCode } = require('../services/googleOAuth');
const TokenService = require('../services/tokenService');
const SessionService = require('../services/sessionService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validateUserRegistration, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginRateLimiter, validateUserLogin, authController.login);

/**
 * @route   GET /api/auth/google
 * @desc    Start Google OAuth login
 * @access  Public
 */
router.get('/google', (req, res) => {
  try {
    const url = getAuthUrl();
    res.redirect(url);
  } catch (e) {
    res.status(500).json({ success: false, error: 'Google OAuth not configured' });
  }
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, error: 'Missing code' });
    const profile = await getUserFromCode(code);

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          password: 'GOOGLE_OAUTH',
          firstName: profile.givenName || null,
          lastName: profile.familyName || null,
          role: 'USER',
          kycStatus: 'PENDING',
        },
      });
    }

    // Create session and tokens
    await SessionService.createSession(user.id, req.get('User-Agent'), req.ip);
    const tokenPair = TokenService.generateTokenPair(user);

    // Redirect back to frontend with tokens (hash fragment to avoid logs)
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontend}/login#accessToken=${encodeURIComponent(tokenPair.accessToken)}&refreshToken=${encodeURIComponent(tokenPair.refreshToken)}`;
    res.redirect(redirectUrl);
  } catch (e) {
    res.status(500).json({ success: false, error: 'Google OAuth failed' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticateToken, authController.getCurrentUser);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
