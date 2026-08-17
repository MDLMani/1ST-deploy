import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createTag,
  getTags,
  getPopularTags,
  updateTag,
  deleteTag,
} from '../controllers/tag.controller';
import { createTagSchema, updateTagSchema } from '../validators';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/tags:
 *   post:
 *     tags: [Tags]
 *     summary: Create a tag (staff only)
 *     responses:
 *       201:
 *         description: Tag created
 */
router.post('/', staffOnly, validate(createTagSchema), createTag);

/**
 * @swagger
 * /api/v1/tags:
 *   get:
 *     tags: [Tags]
 *     summary: Get all tags
 *     responses:
 *       200:
 *         description: Tags retrieved
 */
router.get('/', getTags);

/**
 * @swagger
 * /api/v1/tags/popular:
 *   get:
 *     tags: [Tags]
 *     summary: Get popular tags
 *     responses:
 *       200:
 *         description: Popular tags retrieved
 */
router.get('/popular', getPopularTags);

router.patch('/:id', staffOnly, validate(updateTagSchema), updateTag);
router.delete('/:id', staffOnly, deleteTag);

export default router;
