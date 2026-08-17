import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createRule,
  getRules,
  updateRule,
  deleteRule,
} from '../controllers/escalation.controller';
import { createEscalationRuleSchema, updateEscalationRuleSchema } from '../validators';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/escalation-rules:
 *   post:
 *     tags: [Escalation Rules]
 *     summary: Create an escalation rule (staff only)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               trigger: { type: string, enum: [time_based, priority_change, customer_reply, sla_breach] }
 *               conditions:
 *                 type: object
 *                 properties:
 *                   department: { type: string }
 *                   priority: { type: array, items: { type: string } }
 *                   status: { type: array, items: { type: string } }
 *                   timeElapsedMinutes: { type: number }
 *               actions:
 *                 type: object
 *                 properties:
 *                   assignTo: { type: string }
 *                   changePriority: { type: string }
 *                   addTag: { type: string }
 *                   notifyUsers: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Escalation rule created
 */
router.post('/', staffOnly, validate(createEscalationRuleSchema), createRule);

/**
 * @swagger
 * /api/v1/escalation-rules:
 *   get:
 *     tags: [Escalation Rules]
 *     summary: Get all escalation rules
 *     responses:
 *       200:
 *         description: Escalation rules retrieved
 */
router.get('/', staffOnly, getRules);

router.patch('/:id', staffOnly, validate(updateEscalationRuleSchema), updateRule);
router.delete('/:id', staffOnly, deleteRule);

export default router;
