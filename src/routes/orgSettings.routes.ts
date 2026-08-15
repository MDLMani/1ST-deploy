import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { adminOnly, staffOnly } from '../middleware/role.middleware';
import { getOrgSettings, updateOrgSettings } from '../controllers/orgSettings.controller';

const router = Router();

router.use(authenticate);

router.get('/', staffOnly, getOrgSettings);
router.patch('/', adminOnly, updateOrgSettings);

export default router;
