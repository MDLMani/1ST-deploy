import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { IUser } from '../models/User.model';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/ApiError';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { UserRole } from '../constants';
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput, VerifyOtpInput, UpdateProfileInput, ChangePasswordInput } from '../validators';
import { sendPasswordResetOtp, ensureSmtpReady } from './email.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;
const OTP_SALT_ROUNDS = 8;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_RESEND_COOLDOWN_SEC = 60;
const MAX_OTP_ATTEMPTS = 5;

type AuthUser = {
  id: IUser['_id'];
  name: string;
  email: string;
  role: UserRole;
};

type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type RegisterResult =
  | (AuthResult & { isExistingUser: false })
  | { isExistingUser: true };

export class AuthService {
  private buildAuthResult(user: IUser): AuthResult {
    const tokens = generateTokens(user._id.toString(), user.email, user.role);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existingUser = await userRepository.findByEmail(input.email, true);
    if (existingUser) {
      const isPasswordValid = await bcrypt.compare(input.password, existingUser.password);
      if (!isPasswordValid) {
        throw new ApiError(409, 'Email already registered');
      }

      return { isExistingUser: true };
    }

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    const role =
      input.role && [UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(input.role)
        ? input.role
        : UserRole.USER;

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role,
    });

    return { isExistingUser: false, ...this.buildAuthResult(user) };
  }

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email, true);
    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    return this.buildAuthResult(user);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        throw new ApiError(401, 'Invalid refresh token');
      }

      return generateTokens(user._id.toString(), user.email, user.role);
    } catch {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ cooldownSeconds: number }> {
    const user = await userRepository.findByEmailWithResetOtp(input.email);
    if (!user) {
      if (env.NODE_ENV === 'development') {
        logger.warn(`Forgot password: no account found for ${input.email}`);
      }
      return { cooldownSeconds: OTP_RESEND_COOLDOWN_SEC };
    }

    if (
      user.resetOtpLastSentAt &&
      user.resetOtpExpires &&
      user.resetOtpExpires.getTime() > Date.now()
    ) {
      const elapsed = Date.now() - user.resetOtpLastSentAt.getTime();
      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new ApiError(
          429,
          `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
          true,
          { retryAfterSeconds }
        );
      }
    }

    const otp = this.generateOtp();

    const [resetOtpHash] = await Promise.all([
      bcrypt.hash(otp, OTP_SALT_ROUNDS),
      ensureSmtpReady().catch(() => undefined),
    ]);

    if (env.NODE_ENV === 'development') {
      logger.info(`[DEV] Password reset OTP for ${user.email}: ${otp}`);
    }

    try {
      await sendPasswordResetOtp(user.email, otp, user.name);
    } catch (error) {
      logger.error('Failed to send password reset email', { email: user.email, error });
      throw new ApiError(503, 'Failed to send reset email. Please try again in a moment.');
    }

    await userRepository.setPasswordResetOtp(
      user._id.toString(),
      resetOtpHash,
      new Date(Date.now() + OTP_EXPIRY_MS),
      new Date()
    );

    return { cooldownSeconds: OTP_RESEND_COOLDOWN_SEC };
  }

  private async validateResetOtp(email: string, otp: string): Promise<IUser> {
    const user = await userRepository.findByEmailWithResetOtp(email);
    if (!user?.resetOtpHash || !user.resetOtpExpires) {
      throw new ApiError(400, 'Invalid or expired OTP');
    }

    if (user.resetOtpExpires.getTime() < Date.now()) {
      throw new ApiError(400, 'OTP has expired. Please request a new one.');
    }

    if ((user.resetOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      throw new ApiError(429, 'Too many failed attempts. Please request a new OTP.');
    }

    const isOtpValid = await bcrypt.compare(otp, user.resetOtpHash);
    if (!isOtpValid) {
      await userRepository.updateById(user._id.toString(), {
        resetOtpAttempts: (user.resetOtpAttempts ?? 0) + 1,
      });
      throw new ApiError(400, 'Invalid OTP');
    }

    return user;
  }

  async verifyOtp(input: VerifyOtpInput): Promise<void> {
    await this.validateResetOtp(input.email, input.otp);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const user = await this.validateResetOtp(input.email, input.otp);

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    await userRepository.updateById(user._id.toString(), {
      password: hashedPassword,
      resetOtpHash: undefined,
      resetOtpExpires: undefined,
      resetOtpAttempts: 0,
      resetOtpLastSentAt: undefined,
    });
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const email = input.email.toLowerCase();
    if (email !== user.email.toLowerCase()) {
      const existing = await userRepository.findByEmail(email);
      if (existing && existing._id.toString() !== userId) {
        throw new ApiError(409, 'Email is already in use');
      }
    }

    const updated = await userRepository.updateById(userId, {
      name: input.name.trim(),
      email,
    });

    if (!updated) {
      throw new ApiError(404, 'User not found');
    }

    return {
      id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user?.password) {
      throw new ApiError(404, 'User not found');
    }

    const isCurrentValid = await bcrypt.compare(input.currentPassword, user.password);
    if (!isCurrentValid) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(input.newPassword, user.password);
    if (isSamePassword) {
      throw new ApiError(400, 'New password must be different from your current password');
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    await userRepository.updateById(userId, { password: hashedPassword });
  }
}

export const authService = new AuthService();
