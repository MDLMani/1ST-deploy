import { Response } from 'express';
import { escalationService } from '../services/escalation.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { EscalationRuleInput, UpdateEscalationRuleInput } from '../validators';

export const createRule = asyncHandler(async (req, res: Response) => {
  const input = req.body as EscalationRuleInput;
  const rule = await escalationService.createRule(input);
  sendSuccess(res, 'Escalation rule created', rule, 201);
});

export const getRules = asyncHandler(async (_req, res: Response) => {
  const rules = await escalationService.getRules();
  sendSuccess(res, 'Escalation rules retrieved', rules);
});

export const updateRule = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateEscalationRuleInput;
  const rule = await escalationService.updateRule(getRouteParam(req.params.id), input);
  sendSuccess(res, 'Escalation rule updated', rule);
});

export const deleteRule = asyncHandler(async (req, res: Response) => {
  const result = await escalationService.deleteRule(getRouteParam(req.params.id));
  sendSuccess(res, result.message);
});
