import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createArticle,
  getArticles,
  getArticleBySlug,
  searchArticles,
  getSuggestedArticles,
  voteHelpful,
  updateArticle,
  deleteArticle,
} from '../controllers/knowledgeBase.controller';
import {
  createArticleSchema,
  updateArticleSchema,
  searchArticleSchema,
  voteArticleSchema,
} from '../validators';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/knowledge-base:
 *   post:
 *     tags: [Knowledge Base]
 *     summary: Create a knowledge base article (staff only)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               slug: { type: string }
 *               content: { type: string }
 *               category: { type: string }
 *               tags: { type: array, items: { type: string } }
 *               department: { type: string }
 *               isPublished: { type: boolean }
 *     responses:
 *       201:
 *         description: Article created
 */
router.post('/', staffOnly, validate(createArticleSchema), createArticle);

/**
 * @swagger
 * /api/v1/knowledge-base:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get all articles
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: number }
 *       - in: query
 *         name: limit
 *         schema: { type: number }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Articles retrieved
 */
router.get('/', getArticles);

/**
 * @swagger
 * /api/v1/knowledge-base/search:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Search articles
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', validate(searchArticleSchema), searchArticles);

/**
 * @swagger
 * /api/v1/knowledge-base/suggested:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get suggested articles
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Suggested articles
 */
router.get('/suggested', getSuggestedArticles);

router.get('/:slug', getArticleBySlug);
router.post('/:id/vote', validate(voteArticleSchema), voteHelpful);
router.patch('/:id', staffOnly, validate(updateArticleSchema), updateArticle);
router.delete('/:id', staffOnly, deleteArticle);

export default router;
