import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from '../controllers/department.controller';
import { createDepartmentSchema, updateDepartmentSchema } from '../validators';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/departments:
 *   post:
 *     tags: [Departments]
 *     summary: Create a department (staff only)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Department created
 */
router.post('/', staffOnly, validate(createDepartmentSchema), createDepartment);

/**
 * @swagger
 * /api/v1/departments:
 *   get:
 *     tags: [Departments]
 *     summary: Get all departments
 *     responses:
 *       200:
 *         description: Departments retrieved
 */
router.get('/', getDepartments);

/**
 * @swagger
 * /api/v1/departments/{id}:
 *   get:
 *     tags: [Departments]
 *     summary: Get department by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department retrieved
 */
router.get('/:id', getDepartmentById);

router.patch('/:id', staffOnly, validate(updateDepartmentSchema), updateDepartment);
router.delete('/:id', staffOnly, deleteDepartment);

export default router;
