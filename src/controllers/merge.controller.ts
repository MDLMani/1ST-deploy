import { Response } from 'express';
import { mergeService } from '../services/merge.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { MergeTicketsInput, LinkRelatedInput } from '../validators';

export const mergeTickets = asyncHandler(async (req, res: Response) => {
  const input = req.body as MergeTicketsInput;
  const result = await mergeService.mergeTickets(input, req.user!.userId, req.user!.role);
  sendSuccess(res, result.message);
});

export const linkRelated = asyncHandler(async (req, res: Response) => {
  const input = req.body as LinkRelatedInput;
  const result = await mergeService.linkRelatedTickets(getRouteParam(req.params.id), input);
  sendSuccess(res, result.message);
});

export const unlinkRelated = asyncHandler(async (req, res: Response) => {
  const result = await mergeService.unlinkRelatedTicket(getRouteParam(req.params.id), String(req.params.relatedId));
  sendSuccess(res, result.message);
});
