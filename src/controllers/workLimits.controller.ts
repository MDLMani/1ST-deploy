import { Response } from 'express';
import { workLimitsService } from '../services/workLimits.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getWorkLimitsOverview = asyncHandler(async (req, res: Response) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const data = await workLimitsService.getOverview(from, to, req.user?.userId);
  sendSuccess(res, 'Work limits overview retrieved', data);
});

export const getWorkLimitsTimeline = asyncHandler(async (req, res: Response) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const data = await workLimitsService.getTimeline(from, to, req.user?.userId);
  sendSuccess(res, 'Work limits timeline retrieved', data);
});

export const getWorkLimitsTeamTrack = asyncHandler(async (req, res: Response) => {
  const data = await workLimitsService.getTeamTrack(req.user?.userId);
  sendSuccess(res, 'Team track retrieved', data);
});

export const exportWorkLimitsReport = asyncHandler(async (req, res: Response) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const section = typeof req.query.section === 'string' ? req.query.section : 'full';
  const csv = await workLimitsService.exportCsv(section, from, to, req.user?.userId);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="work-limits-${section}-${stamp}.csv"`);
  res.status(200).send(csv);
});
