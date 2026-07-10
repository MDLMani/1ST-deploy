import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { getSLAStats, getSLAPolicies, getTicketSLA } from '../controllers/sla.controller';

const router = Router();

router.use(authenticate);

router.get('/stats', staffOnly, getSLAStats);
router.get('/policies', staffOnly, getSLAPolicies);
router.get('/tickets/:id', staffOnly, getTicketSLA);

export default router;
