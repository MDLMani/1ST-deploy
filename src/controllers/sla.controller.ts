import { Response } from 'express';
import { slaService } from '../services/sla.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getSLAStats = asyncHandler(async (_req, res: Response) => {
  const stats = await slaService.getSLAStats();
  sendSuccess(res, 'SLA stats retrieved', stats);
});

export const getSLAPolicies = asyncHandler(async (_req, res: Response) => {
  const policies = await slaService.getPolicies();
  sendSuccess(res, 'SLA policies retrieved', policies);
});

export const getTicketSLA = asyncHandler(async (req, res: Response) => {
  const status = await slaService.getTicketSLAStatus(getRouteParam(req.params.id));
  sendSuccess(res, 'Ticket SLA status retrieved', status);
});
