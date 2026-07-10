import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCustomField,
  getCustomFields,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
} from '../controllers/customField.controller';
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  reorderCustomFieldsSchema,
} from '../validators';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/custom-fields:
 *   post:
 *     tags: [Custom Fields]
 *     summary: Create a custom field (staff only)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               key: { type: string }
 *               type: { type: string, enum: [text, number, select, multi_select, date, boolean] }
 *               options: { type: array, items: { type: string } }
 *               department: { type: string }
 *               isRequired: { type: boolean }
 *               defaultValue: { type: string }
 *               displayOrder: { type: number }
 *     responses:
 *       201:
 *         description: Custom field created
 */
router.post('/', staffOnly, validate(createCustomFieldSchema), createCustomField);

/**
 * @swagger
 * /api/v1/custom-fields:
 *   get:
 *     tags: [Custom Fields]
 *     summary: Get all custom fields
 *     parameters:
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Custom fields retrieved
 */
router.get('/', getCustomFields);

router.patch('/:id', staffOnly, validate(updateCustomFieldSchema), updateCustomField);
router.delete('/:id', staffOnly, deleteCustomField);
router.post('/reorder', staffOnly, validate(reorderCustomFieldsSchema), reorderCustomFields);

export default router;
