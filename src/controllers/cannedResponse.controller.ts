import { Response } from 'express';
import { cannedResponseService } from '../services/cannedResponse.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { CannedResponseInput, UpdateCannedResponseInput } from '../validators';

export const createCannedResponse = asyncHandler(async (req, res: Response) => {
  const input = req.body as CannedResponseInput;
  const response = await cannedResponseService.createCannedResponse(input, req.user!.userId);
  sendSuccess(res, 'Canned response created', response, 201);
});

export const getCannedResponses = asyncHandler(async (req, res: Response) => {
  const { page, limit, category, search } = req.query as any;
  const result = await cannedResponseService.getCannedResponses(req.user!.userId, page ? Number(page) : undefined, limit ? Number(limit) : undefined, category as string, search as string);
  sendSuccess(res, 'Canned responses retrieved', result.responses, 200, { total: result.total });
});

export const lookupByShortcut = asyncHandler(async (req, res: Response) => {
  const response = await cannedResponseService.lookupByShortcut(String(req.params.shortcut), req.user!.userId);
  sendSuccess(res, 'Canned response found', response);
});

export const updateCannedResponse = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateCannedResponseInput;
  const response = await cannedResponseService.updateCannedResponse(getRouteParam(req.params.id), input, req.user!.userId);
  sendSuccess(res, 'Canned response updated', response);
});

export const deleteCannedResponse = asyncHandler(async (req, res: Response) => {
  const result = await cannedResponseService.deleteCannedResponse(getRouteParam(req.params.id), req.user!.userId);
  sendSuccess(res, result.message);
});
