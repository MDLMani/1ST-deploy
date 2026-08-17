import { Response } from 'express';
import { orgSettingsService } from '../services/orgSettings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getOrgSettings = asyncHandler(async (_req, res: Response) => {
  const data = await orgSettingsService.getPublic();
  sendSuccess(res, 'Org settings retrieved', data);
});

export const updateOrgSettings = asyncHandler(async (req, res: Response) => {
  const data = await orgSettingsService.update(req.body ?? {}, req.user?.userId);
  sendSuccess(res, 'Org settings updated', data);
});
