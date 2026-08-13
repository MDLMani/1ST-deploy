import { Response } from 'express';
import { userManagementService } from '../services/userManagement.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { IJwtPayload } from '../interfaces';
import {
  AcceptInvitationInput,
  InviteUserInput,
  KeepPendingInput,
  RejectInvitationInput,
  SetUserActiveInput,
  UserManagementListQuery,
} from '../validators';

function requireUser(req: { user?: IJwtPayload }): IJwtPayload {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

export const listManagedUsers = asyncHandler(async (req, res: Response) => {
  const query = req.query as UserManagementListQuery;
  const result = await userManagementService.list(requireUser(req), query);
  sendSuccess(res, 'Users retrieved', result);
});

export const listOverdueUsers = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.listOverdue(requireUser(req));
  sendSuccess(res, 'Overdue items retrieved', result);
});

export const getPermittedRoles = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.getPermittedRoles(requireUser(req));
  sendSuccess(res, 'Permitted roles retrieved', result);
});

export const getManagers = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.getManagers(requireUser(req));
  sendSuccess(res, 'Managers retrieved', result);
});

export const listAuditEvents = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.listAudit(requireUser(req));
  sendSuccess(res, 'Audit trail retrieved', result);
});

export const getManagedUser = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.getDetails(requireUser(req), getRouteParam(req.params.id));
  sendSuccess(res, 'User details retrieved', result);
});

export const inviteUser = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.invite(requireUser(req), req.body as InviteUserInput);
  sendSuccess(res, 'Invitation sent', result, 201);
});

export const resendInvitation = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.resend(requireUser(req), getRouteParam(req.params.id));
  sendSuccess(res, 'Invitation resent', result);
});

export const approveInvitation = asyncHandler(async (req, res: Response) => {
  const role = (req.body as { role?: string } | undefined)?.role;
  const result = await userManagementService.approve(
    requireUser(req),
    getRouteParam(req.params.id),
    role as InviteUserInput['role'] | undefined
  );
  sendSuccess(res, 'User approved', result);
});

export const rejectInvitation = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.reject(
    requireUser(req),
    getRouteParam(req.params.id),
    (req.body ?? {}) as RejectInvitationInput
  );
  sendSuccess(res, 'User rejected', result);
});

export const keepInvitationPending = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.keepPending(
    requireUser(req),
    getRouteParam(req.params.id),
    req.body as KeepPendingInput
  );
  sendSuccess(res, 'User kept pending', result);
});

export const setManagedUserActive = asyncHandler(async (req, res: Response) => {
  const { isActive } = req.body as SetUserActiveInput;
  const result = await userManagementService.setUserActive(
    requireUser(req),
    getRouteParam(req.params.id),
    isActive
  );
  sendSuccess(res, isActive ? 'User activated' : 'User deactivated', result);
});

export const verifyInvitation = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.verifyToken(getRouteParam(req.params.token));
  sendSuccess(res, 'Invitation is valid', result);
});

export const acceptInvitation = asyncHandler(async (req, res: Response) => {
  const result = await userManagementService.accept(req.body as AcceptInvitationInput);
  sendSuccess(res, 'Invitation accepted', result);
});
