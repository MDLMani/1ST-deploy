import { Router } from 'express';
import { saveDraft, getDrafts, deleteDraft } from '../controllers/draft.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

/** GET /drafts */
router.get('/', getDrafts);

/** POST /drafts */
router.post('/', saveDraft);

/** DELETE /drafts/:id */
router.delete('/:id', deleteDraft);

export default router;
