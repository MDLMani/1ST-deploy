import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  getProfile,
  getStaff,
  forgotPassword,
  resetPassword,
  verifyOtp,
} from '../controllers/auth.controller';
import { sendSmsCode, verifySmsCode } from '../controllers/sms.controller';
import { updateProfile, changePassword } from '../controllers/account.controller';
import { validate } from '../middleware/validate.middleware';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  verifyOtpSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators';

const router = Router();

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit to 5 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many SMS requests, please try again later',
  },
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/send-sms-code', authenticate, smsLimiter, validate(phoneOtpRequestSchema), sendSmsCode);
router.post('/verify-sms-code', authenticate, validate(phoneOtpVerifySchema), verifySmsCode);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, validate(updateProfileSchema), updateProfile);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);

router.get('/staff', authenticate, staffOnly, getStaff);

export default router;
