import { Router } from 'express';
import authRoutes from './auth.routes';
import ticketRoutes from './ticket.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);

export default router;
