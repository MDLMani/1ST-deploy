import { Response } from 'express';
import { assistantService } from '../services/assistant.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { AssistantChatInput } from '../validators';
import { isOpenAiConfigured } from '../config/env';

export const chat = asyncHandler(async (req, res: Response) => {
  const input = req.body as AssistantChatInput;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const message = (input.message ?? '').trim();

  if (!message && files.length === 0) {
    throw new ApiError(400, 'Message or attachment is required');
  }

  const result = await assistantService.chat({
    user: req.user!,
    message,
    locale: input.locale ?? 'en',
    historyRaw: input.history ?? '[]',
    files,
  });

  sendSuccess(res, 'Assistant reply', result);
});

export const getAssistantStatus = asyncHandler(async (_req, res: Response) => {
  sendSuccess(res, 'Assistant status', {
    aiEnabled: isOpenAiConfigured(),
    provider: isOpenAiConfigured() ? 'openai' : 'fallback',
  });
});
