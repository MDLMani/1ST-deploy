import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { draftService } from '../services/draft.service';

export const saveDraft = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { content, meta } = req.body as { content: string; meta?: Record<string, any> };
  const draft = await draftService.saveDraft(userId, content ?? '', meta ?? {});
  sendSuccess(res, 'Draft saved', { draft }, 201);
});

export const getDrafts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const drafts = await draftService.getDrafts(userId);
  sendSuccess(res, 'Drafts retrieved', { drafts });
});

export const deleteDraft = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params as { id: string };
  await draftService.deleteDraft(userId, id);
  sendSuccess(res, 'Draft deleted');
});
