import { Router } from 'express';
import authRoutes from './auth.routes';
import ticketRoutes from './ticket.routes';
import notificationRoutes from './notification.routes';
import pushRoutes from './push.routes';
import departmentRoutes from './department.routes';
import tagRoutes from './tag.routes';
import cannedResponseRoutes from './cannedResponse.routes';
import knowledgeBaseRoutes from './knowledgeBase.routes';
import customFieldRoutes from './customField.routes';
import escalationRoutes from './escalation.routes';
import satisfactionRoutes from './satisfaction.routes';
import slaRoutes from './sla.routes';
import assignmentRoutes from './assignment.routes';
import userManagementRoutes from './userManagement.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user-management', userManagementRoutes);
router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);
router.use('/push', pushRoutes);
router.use('/departments', departmentRoutes);
router.use('/tags', tagRoutes);
router.use('/canned-responses', cannedResponseRoutes);
router.use('/knowledge-base', knowledgeBaseRoutes);
router.use('/custom-fields', customFieldRoutes);
router.use('/escalation-rules', escalationRoutes);
router.use('/satisfaction', satisfactionRoutes);
router.use('/sla', slaRoutes);
router.use('/assignments', assignmentRoutes);

export default router;
