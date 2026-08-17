import { Response } from 'express';
import { assignmentService } from '../services/assignment.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AssignmentRuleInput, UpdateAssignmentRuleInput } from '../validators';

export const createAssignmentRule = asyncHandler(async (req, res: Response) => {
  const input = req.body as AssignmentRuleInput;
  const rule = await assignmentService.createRule(req.user!.userId, input);
  sendSuccess(res, 'Assignment rule created', rule, 201);
});

export const getAssignmentRules = asyncHandler(async (_req, res: Response) => {
  const rules = await assignmentService.getRules();
  sendSuccess(res, 'Assignment rules retrieved', rules);
});

export const updateAssignmentRule = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateAssignmentRuleInput;
  const rule = await assignmentService.updateRule(getRouteParam(req.params.id), input);
  sendSuccess(res, 'Assignment rule updated', rule);
});

export const deleteAssignmentRule = asyncHandler(async (req, res: Response) => {
  const result = await assignmentService.deleteRule(getRouteParam(req.params.id));
  sendSuccess(res, result.message);
});

export const triggerAutoAssign = asyncHandler(async (req, res: Response) => {
  const ticketId = getRouteParam(req.params.ticketId);
  const ticket = await assignmentService.autoAssignTicket(ticketId);
  if (!ticket) {
    sendSuccess(res, 'No matching assignment rule or agent available', null);
    return;
  }
  sendSuccess(res, 'Ticket auto-assigned', { agentId: ticket._id, agentName: ticket.name });
});
