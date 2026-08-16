import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { sendVerificationCode, verifyCode } from '../services/sms.service';
import { userRepository } from '../repositories/user.repository';

export const sendSmsCode = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body as { phone: string };
  const userId = req.user?.userId ?? null;
  if (!phone) {
    sendError(res, 'phone required', 400);
    return;
  }

  const ok = await sendVerificationCode(userId, phone);
  if (!ok) {
    sendError(res, 'Failed to send SMS', 500);
    return;
  }
  sendSuccess(res, 'Verification code sent');
});

export const verifySmsCode = asyncHandler(async (req: Request, res: Response) => {
  const { phone, code } = req.body as { phone: string; code: string };
  if (!phone || !code) {
    sendError(res, 'phone and code required', 400);
    return;
  }

  const result = await verifyCode(phone, code);
  if (!result.ok) {
    sendError(res, result.reason ?? 'invalid', 400);
    return;
  }

  // Optionally link phone to user if authenticated
  if (req.user?.userId) {
    await userRepository.updateById(req.user.userId, { $set: { phone, phoneVerified: true } });
  }

  sendSuccess(res, 'Phone verified');
});
