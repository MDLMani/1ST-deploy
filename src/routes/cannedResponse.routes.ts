import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCannedResponse,
  getCannedResponses,
  lookupByShortcut,
  updateCannedResponse,
  deleteCannedResponse,
} from '../controllers/cannedResponse.controller';
import { createCannedResponseSchema, updateCannedResponseSchema } from '../validators';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/canned-responses:
 *   post:
 *     tags: [Canned Responses]
 *     summary: Create a canned response (staff only)
 *     responses:
 *       201:
 *         description: Canned response created
 */
router.post('/', staffOnly, validate(createCannedResponseSchema), createCannedResponse);

/**
 * @swagger
 * /api/v1/canned-responses:
 *   get:
 *     tags: [Canned Responses]
 *     summary: Get canned responses
 *     responses:
 *       200:
 *         description: Canned responses retrieved
 */
router.get('/', staffOnly, getCannedResponses);

/**
 * @swagger
 * /api/v1/canned-responses/shortcut/{shortcut}:
 *   get:
 *     tags: [Canned Responses]
 *     summary: Lookup canned response by shortcut
 *     parameters:
 *       - in: path
 *         name: shortcut
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Canned response found
 */
router.get('/shortcut/:shortcut', staffOnly, lookupByShortcut);

router.patch('/:id', staffOnly, validate(updateCannedResponseSchema), updateCannedResponse);
router.delete('/:id', staffOnly, deleteCannedResponse);

export default router;
