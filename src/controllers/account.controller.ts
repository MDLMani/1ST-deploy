import { Response } from 'express';
import { accountService } from '../services/account.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getAccount = asyncHandler(async (req, res: Response) => {
  const account = await accountService.getAccount(req.user!.userId);
  sendSuccess(res, 'Account retrieved', { user: account });
});

export const updateProfile = asyncHandler(async (req, res: Response) => {
  const account = await accountService.updateProfile(req.user!.userId, req.body);
  sendSuccess(res, 'Profile updated', { user: account });
});

export const changePassword = asyncHandler(async (req, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  await accountService.changePassword(req.user!.userId, currentPassword, newPassword);
  sendSuccess(res, 'Password updated');
});

export const requestPhoneOtp = asyncHandler(async (req, res: Response) => {
  const { phone } = req.body as { phone: string };
  const result = await accountService.requestPhoneOtp(req.user!.userId, phone);
  sendSuccess(res, 'OTP sent', result);
});

export const verifyPhoneOtp = asyncHandler(async (req, res: Response) => {
  const { phone, otp } = req.body as { phone: string; otp: string };
  const user = await accountService.verifyPhoneOtp(req.user!.userId, phone, otp);
  sendSuccess(res, 'Phone verified', { user });
});

export const listSessions = asyncHandler(async (req, res: Response) => {
  const currentRefresh = (req.headers['x-refresh-token'] as string) || undefined;
  const sessions = await accountService.listSessions(req.user!.userId, currentRefresh);
  sendSuccess(res, 'Sessions retrieved', { sessions });
});

export const revokeSession = asyncHandler(async (req, res: Response) => {
  await accountService.revokeSession(req.user!.userId, String(req.params.id));
  sendSuccess(res, 'Session revoked');
});

export const revokeOtherSessions = asyncHandler(async (req, res: Response) => {
  const keep = (req.body?.refreshToken as string) || (req.headers['x-refresh-token'] as string);
  const count = await accountService.revokeOtherSessions(req.user!.userId, keep);
  sendSuccess(res, 'Other sessions revoked', { revoked: count });
});

export const deleteAccount = asyncHandler(async (req, res: Response) => {
  const { password } = req.body as { password: string };
  await accountService.softDeleteAccount(req.user!.userId, password);
  sendSuccess(res, 'Account deactivated');
});

export const exportAccount = asyncHandler(async (req, res: Response) => {
  const data = await accountService.exportAccountData(req.user!.userId);
  sendSuccess(res, 'Export ready', data);
});

export const listAddresses = asyncHandler(async (req, res: Response) => {
  const account = await accountService.getAccount(req.user!.userId);
  sendSuccess(res, 'Addresses retrieved', { addresses: account.savedAddresses });
});

export const addAddress = asyncHandler(async (req, res: Response) => {
  const user = await accountService.addAddress(req.user!.userId, req.body);
  sendSuccess(res, 'Address added', { user }, 201);
});

export const updateAddress = asyncHandler(async (req, res: Response) => {
  const user = await accountService.updateAddress(
    req.user!.userId,
    String(req.params.id),
    req.body
  );
  sendSuccess(res, 'Address updated', { user });
});

export const removeAddress = asyncHandler(async (req, res: Response) => {
  const user = await accountService.removeAddress(req.user!.userId, String(req.params.id));
  sendSuccess(res, 'Address removed', { user });
});

export const listFamily = asyncHandler(async (req, res: Response) => {
  const account = await accountService.getAccount(req.user!.userId);
  sendSuccess(res, 'Family retrieved', { familyMembers: account.familyMembers });
});

export const addFamily = asyncHandler(async (req, res: Response) => {
  const user = await accountService.addFamilyMember(req.user!.userId, req.body);
  sendSuccess(res, 'Family member added', { user }, 201);
});

export const updateFamily = asyncHandler(async (req, res: Response) => {
  const user = await accountService.updateFamilyMember(
    req.user!.userId,
    String(req.params.id),
    req.body
  );
  sendSuccess(res, 'Family member updated', { user });
});

export const removeFamily = asyncHandler(async (req, res: Response) => {
  const user = await accountService.removeFamilyMember(
    req.user!.userId,
    String(req.params.id)
  );
  sendSuccess(res, 'Family member removed', { user });
});
