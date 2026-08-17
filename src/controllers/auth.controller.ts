import { Response } from 'express';
import { authService } from '../services/auth.service';
import { accountService } from '../services/account.service';
import { userRepository } from '../repositories/user.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from '../validators';
import { verifyRefreshToken } from '../utils/jwt';

export const register = asyncHandler(async (req, res: Response) => {
  const input = req.body as RegisterInput;
  const result = await authService.register(input);

  if (result.isExistingUser) {
    sendSuccess(res, 'Account already exists, please login', undefined, 200);
    return;
  }

  const { isExistingUser: _, ...data } = result;
  sendSuccess(res, 'Registration successful', data, 201);
});

export const login = asyncHandler(async (req, res: Response) => {
  const input = req.body as LoginInput;
  const result = await authService.login(input);
  try {
    await accountService.createSession({
      userId: String(result.user.id),
      refreshToken: result.refreshToken,
      deviceName: (req.headers['x-device-name'] as string) || 'Mobile app',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  } catch {
    // Session tracking is best-effort
  }
  const account = await accountService.getAccount(String(result.user.id));
  sendSuccess(res, 'Login successful', {
    ...result,
    user: account,
  });
});

export const refreshToken = asyncHandler(async (req, res: Response) => {
  const { refreshToken: token } = req.body as RefreshTokenInput;
  const tokens = await authService.refreshToken(token);
  try {
    const payload = verifyRefreshToken(token);
    await accountService.touchSessionByRefreshToken(payload.userId, token);
  } catch {
    // ignore
  }
  sendSuccess(res, 'Token refreshed successfully', tokens);
});

export const getProfile = asyncHandler(async (req, res: Response) => {
  const account = await accountService.getAccount(req.user!.userId);
  sendSuccess(res, 'Profile retrieved', { user: account });
});

export const updateProfile = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateProfileInput;
  const user = await authService.updateProfile(req.user!.userId, input);
  sendSuccess(res, 'Profile updated successfully', { user });
});

export const changePassword = asyncHandler(async (req, res: Response) => {
  const input = req.body as ChangePasswordInput;
  await authService.changePassword(req.user!.userId, input);
  sendSuccess(res, 'Password changed successfully');
});

export const getStaff = asyncHandler(async (_req, res: Response) => {
  const staff = await userRepository.findAgentsAndAdmins();
  sendSuccess(
    res,
    'Staff retrieved',
    staff.map((u) => accountService.toPublicAccount(u))
  );
});

export const forgotPassword = asyncHandler(async (req, res: Response) => {
  const input = req.body as ForgotPasswordInput;
  const result = await authService.forgotPassword(input);
  sendSuccess(
    res,
    'If an account exists with that email, a password reset OTP has been sent.',
    result,
    200
  );
});

export const resetPassword = asyncHandler(async (req, res: Response) => {
  const input = req.body as ResetPasswordInput;
  await authService.resetPassword(input);
  sendSuccess(res, 'Password reset successful');
});

export const verifyOtp = asyncHandler(async (req, res: Response) => {
  const input = req.body as VerifyOtpInput;
  await authService.verifyOtp(input);
  sendSuccess(res, 'OTP verified');
});
