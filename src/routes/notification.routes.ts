import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 *     responses:
 *       200:
 *         description: Notifications retrieved
 */
router.get('/', getNotifications);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     responses:
 *       200:
 *         description: All marked as read
 */
router.patch('/read-all', markAllAsRead);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', markAsRead);

export default router;
