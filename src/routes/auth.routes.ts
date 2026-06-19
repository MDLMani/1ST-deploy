import { Router } from 'express';
import { register, login, refreshToken, getProfile, getStaff } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../validators';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post('/register', validate(registerSchema), register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', validate(loginSchema), login);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Token refreshed
 */
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     responses:
 *       200:
 *         description: Profile retrieved
 */
router.get('/profile', authenticate, getProfile);

/**
 * @swagger
 * /api/v1/auth/staff:
 *   get:
 *     tags: [Auth]
 *     summary: List admin and support agents (staff only)
 *     responses:
 *       200:
 *         description: Staff list retrieved
 */
router.get('/staff', authenticate, staffOnly, getStaff);

export default router;
