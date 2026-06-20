import { Response } from 'express';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { RegisterInput, LoginInput, RefreshTokenInput, ForgotPasswordInput, ResetPasswordInput, VerifyOtpInput } from '../validators';

const toPublicUser = (user: { _id: unknown; name: string; email: string; role: string }) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
});

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
  sendSuccess(res, 'Login successful', result);
});

export const refreshToken = asyncHandler(async (req, res: Response) => {
  const { refreshToken: token } = req.body as RefreshTokenInput;
  const tokens = await authService.refreshToken(token);
  sendSuccess(res, 'Token refreshed successfully', tokens);
});

export const getProfile = asyncHandler(async (req, res: Response) => {
  const user = await userRepository.findById(req.user!.userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  sendSuccess(res, 'Profile retrieved', { user: toPublicUser(user) });
});

export const getStaff = asyncHandler(async (_req, res: Response) => {
  const staff = await userRepository.findAgentsAndAdmins();
  sendSuccess(res, 'Staff retrieved', staff.map(toPublicUser));
});

export const forgotPassword = asyncHandler(async (req, res: Response) => {
  const input = req.body as ForgotPasswordInput;
  await authService.forgotPassword(input);
  sendSuccess(
    res,
    'If an account exists with that email, a password reset OTP has been sent.',
    undefined,
    200
  );
});

export const resetPassword = asyncHandler(async (req, res: Response) => {
  const input = req.body as ResetPasswordInput;
  await authService.resetPassword(input);
  sendSuccess(res, 'Password reset successful. You can now sign in with your new password.');
});

export const verifyOtp = asyncHandler(async (req, res: Response) => {
  const input = req.body as VerifyOtpInput;
  await authService.verifyOtp(input);
  sendSuccess(res, 'OTP verified successfully', { valid: true });
});
