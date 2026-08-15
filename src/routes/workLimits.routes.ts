import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import {
  exportWorkLimitsReport,
  getWorkLimitsOverview,
  getWorkLimitsTimeline,
} from '../controllers/workLimits.controller';

const router = Router();

router.use(authenticate);

router.get('/overview', staffOnly, getWorkLimitsOverview);
router.get('/timeline', staffOnly, getWorkLimitsTimeline);
router.get('/export', staffOnly, exportWorkLimitsReport);

export default router;
