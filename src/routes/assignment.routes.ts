import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorize, staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '../constants';
import {
  createAssignmentRule,
  getAssignmentRules,
  updateAssignmentRule,
  deleteAssignmentRule,
  triggerAutoAssign,
} from '../controllers/assignment.controller';
import { createAssignmentRuleSchema, updateAssignmentRuleSchema } from '../validators';

const router = Router();
const adminOnly = authorize(UserRole.ADMIN);

router.use(authenticate);

router.post('/rules', adminOnly, validate(createAssignmentRuleSchema), createAssignmentRule);
router.get('/rules', adminOnly, getAssignmentRules);
router.patch('/rules/:id', adminOnly, validate(updateAssignmentRuleSchema), updateAssignmentRule);
router.delete('/rules/:id', adminOnly, deleteAssignmentRule);
router.post('/auto/:ticketId', staffOnly, triggerAutoAssign);

export default router;
