import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  submitRating,
  getTicketRating,
  getCSATStats,
} from '../controllers/satisfaction.controller';
import { submitRatingSchema } from '../validators';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/satisfaction/tickets/{id}/rating:
 *   post:
 *     tags: [Satisfaction]
 *     summary: Submit a satisfaction rating for a ticket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating: { type: number, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *     responses:
 *       201:
 *         description: Rating submitted
 */
router.post('/tickets/:id/rating', validate(submitRatingSchema), submitRating);

/**
 * @swagger
 * /api/v1/satisfaction/tickets/{id}/rating:
 *   get:
 *     tags: [Satisfaction]
 *     summary: Get the rating for a ticket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Rating retrieved
 */
router.get('/tickets/:id/rating', getTicketRating);

/**
 * @swagger
 * /api/v1/satisfaction/csat-stats:
 *   get:
 *     tags: [Satisfaction]
 *     summary: Get CSAT statistics (staff only)
 *     responses:
 *       200:
 *         description: CSAT stats retrieved
 */
router.get('/csat-stats', staffOnly, getCSATStats);

export default router;
