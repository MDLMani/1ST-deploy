import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadAssistantFiles } from '../middleware/upload.middleware';
import { assistantChatSchema } from '../validators';
import { chat, getAssistantStatus } from '../controllers/assistant.controller';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/assistant/status:
 *   get:
 *     tags: [Assistant]
 *     summary: Whether OpenAI-compatible AI is configured
 *     responses:
 *       200:
 *         description: Assistant status
 */
router.get('/status', getAssistantStatus);

/**
 * @swagger
 * /api/v1/assistant/chat:
 *   post:
 *     tags: [Assistant]
 *     summary: Send a chat message with optional image/document uploads
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *               locale: { type: string, enum: [en, ta] }
 *               history:
 *                 type: string
 *                 description: JSON array of chat turns with role and content
 *               attachments:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Assistant reply
 */
router.post('/chat', uploadAssistantFiles, validate(assistantChatSchema), chat);

export default router;
