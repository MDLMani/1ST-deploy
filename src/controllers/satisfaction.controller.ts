import { Response } from 'express';
import { satisfactionService } from '../services/satisfaction.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { SubmitRatingInput } from '../validators';

export const submitRating = asyncHandler(async (req, res: Response) => {
  const input = req.body as SubmitRatingInput;
  const rating = await satisfactionService.submitRating(getRouteParam(req.params.id), req.user!.userId, input);
  sendSuccess(res, 'Rating submitted', rating, 201);
});

export const getTicketRating = asyncHandler(async (req, res: Response) => {
  const rating = await satisfactionService.getTicketRating(getRouteParam(req.params.id));
  sendSuccess(res, 'Rating retrieved', rating);
});

export const getCSATStats = asyncHandler(async (_req, res: Response) => {
  const stats = await satisfactionService.getCSATStats();
  sendSuccess(res, 'CSAT stats retrieved', stats);
});
