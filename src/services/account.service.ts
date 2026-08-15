import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AuthSession } from '../models/AuthSession.model';
import { IUser } from '../models/User.model';
import { Ticket } from '../models/Ticket.model';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export type PublicAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  phoneVerified?: boolean;
  district?: string;
  taluk?: string;
  city?: string;
  ward?: string;
  preferredDepartmentId?: string;
  identityDefaults?: {
    fullName?: string;
    fatherName?: string;
    idType?: string;
  };
  notificationPrefs: {
    ticketUpdates: boolean;
    staffReplies: boolean;
    overdue: boolean;
    system: boolean;
  };
  savedAddresses: Array<{
    id: string;
    label: string;
    street?: string;
    villageTown?: string;
    taluk?: string;
    district?: string;
    isDefault?: boolean;
  }>;
  familyMembers: Array<{
    id: string;
    name: string;
    relation: string;
    phone?: string;
    district?: string;
    notes?: string;
  }>;
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function defaultNotificationPrefs() {
  return {
    ticketUpdates: true,
    staffReplies: true,
    overdue: true,
    system: true,
  };
}

export class AccountService {
  toPublicAccount(user: IUser): PublicAccount {
    const prefs = user.notificationPrefs ?? defaultNotificationPrefs();
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      phoneVerified: Boolean(user.phoneVerified),
      district: user.district,
      taluk: user.taluk,
      city: user.city,
      ward: user.ward,
      preferredDepartmentId: user.preferredDepartmentId,
      identityDefaults: user.identityDefaults
        ? {
            fullName: user.identityDefaults.fullName,
            fatherName: user.identityDefaults.fatherName,
            idType: user.identityDefaults.idType,
          }
        : undefined,
      notificationPrefs: {
        ticketUpdates: prefs.ticketUpdates !== false,
        staffReplies: prefs.staffReplies !== false,
        overdue: prefs.overdue !== false,
        system: prefs.system !== false,
      },
      savedAddresses: (user.savedAddresses ?? []).map((a) => ({
        id: String(a._id),
        label: a.label,
        street: a.street,
        villageTown: a.villageTown,
        taluk: a.taluk,
        district: a.district,
        isDefault: a.isDefault,
      })),
      familyMembers: (user.familyMembers ?? []).map((m) => ({
        id: String(m._id),
        name: m.name,
        relation: m.relation,
        phone: m.phone,
        district: m.district,
        notes: m.notes,
      })),
    };
  }

  async getAccount(userId: string): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user || user.deletedAt) {
      throw new ApiError(404, 'User not found');
    }
    return this.toPublicAccount(user);
  }

  async updateProfile(
    userId: string,
    input: {
      name?: string;
      email?: string;
      phone?: string;
      district?: string;
      taluk?: string;
      city?: string;
      ward?: string;
      preferredDepartmentId?: string | null;
      identityDefaults?: {
        fullName?: string;
        fatherName?: string;
        idType?: string;
      };
      notificationPrefs?: Partial<{
        ticketUpdates: boolean;
        staffReplies: boolean;
        overdue: boolean;
        system: boolean;
      }>;
    }
  ): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user || user.deletedAt) {
      throw new ApiError(404, 'User not found');
    }

    const $set: Record<string, unknown> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2) throw new ApiError(400, 'Name must be at least 2 characters');
      $set.name = name;
    }

    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!email.includes('@')) throw new ApiError(400, 'Invalid email address');
      if (email !== user.email) {
        const existing = await userRepository.findByEmail(email);
        if (existing && String(existing._id) !== userId) {
          throw new ApiError(409, 'Email already in use');
        }
        $set.email = email;
      }
    }

    if (input.phone !== undefined) {
      const phone = input.phone.trim();
      $set.phone = phone;
      if (phone !== (user.phone ?? '')) {
        $set.phoneVerified = false;
      }
    }

    for (const key of ['district', 'taluk', 'city', 'ward'] as const) {
      if (input[key] !== undefined) {
        $set[key] = String(input[key] ?? '').trim();
      }
    }

    if (input.preferredDepartmentId !== undefined) {
      $set.preferredDepartmentId = input.preferredDepartmentId
        ? String(input.preferredDepartmentId).trim()
        : '';
    }

    if (input.identityDefaults !== undefined) {
      $set.identityDefaults = {
        fullName: input.identityDefaults.fullName?.trim() ?? '',
        fatherName: input.identityDefaults.fatherName?.trim() ?? '',
        idType: input.identityDefaults.idType?.trim() ?? '',
      };
    }

    if (input.notificationPrefs !== undefined) {
      const current = user.notificationPrefs ?? defaultNotificationPrefs();
      $set.notificationPrefs = {
        ticketUpdates:
          input.notificationPrefs.ticketUpdates ?? current.ticketUpdates ?? true,
        staffReplies:
          input.notificationPrefs.staffReplies ?? current.staffReplies ?? true,
        overdue: input.notificationPrefs.overdue ?? current.overdue ?? true,
        system: input.notificationPrefs.system ?? current.system ?? true,
      };
    }

    const updated = await userRepository.updateById(userId, { $set });
    if (!updated) throw new ApiError(404, 'User not found');
    return this.toPublicAccount(updated);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const withPassword = await userRepository.findByEmail(user.email, true);
    if (!withPassword?.password) throw new ApiError(404, 'User not found');

    const ok = await bcrypt.compare(currentPassword, withPassword.password);
    if (!ok) throw new ApiError(400, 'Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userRepository.updateById(userId, { password: hashed });
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async requestPhoneOtp(userId: string, phone: string): Promise<{ cooldownSeconds: number }> {
    const cleaned = phone.trim();
    if (cleaned.length < 8) throw new ApiError(400, 'Enter a valid phone number');

    const otp = this.generateOtp();
    const phoneOtpHash = await bcrypt.hash(otp, SALT_ROUNDS);

    await userRepository.updateById(userId, {
      $set: {
        phone: cleaned,
        phoneVerified: false,
        phoneOtpHash,
        phoneOtpExpires: new Date(Date.now() + OTP_EXPIRY_MS),
        phoneOtpAttempts: 0,
      },
    });

    if (env.NODE_ENV === 'development') {
      logger.info(`[DEV] Phone OTP for ${cleaned}: ${otp}`);
    } else {
      logger.info(`Phone OTP generated for user ${userId}`);
    }

    return { cooldownSeconds: 60 };
  }

  async verifyPhoneOtp(userId: string, phone: string, otp: string): Promise<PublicAccount> {
    const user = await (
      await import('../models/User.model')
    ).User.findById(userId)
      .select('+phoneOtpHash +phoneOtpExpires +phoneOtpAttempts')
      .exec();

    if (!user || user.deletedAt) throw new ApiError(404, 'User not found');
    if (!user.phoneOtpHash || !user.phoneOtpExpires) {
      throw new ApiError(400, 'No OTP requested. Request a new code.');
    }
    if (user.phoneOtpExpires.getTime() < Date.now()) {
      throw new ApiError(400, 'OTP has expired. Request a new code.');
    }
    if ((user.phoneOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      throw new ApiError(429, 'Too many failed attempts. Request a new OTP.');
    }
    if ((user.phone ?? '').trim() !== phone.trim()) {
      throw new ApiError(400, 'Phone number does not match the OTP request');
    }

    const valid = await bcrypt.compare(otp, user.phoneOtpHash);
    if (!valid) {
      await userRepository.updateById(userId, {
        phoneOtpAttempts: (user.phoneOtpAttempts ?? 0) + 1,
      });
      throw new ApiError(400, 'Invalid OTP');
    }

    const updated = await userRepository.updateById(userId, {
      $set: {
        phoneVerified: true,
        phone: phone.trim(),
      },
      $unset: {
        phoneOtpHash: 1,
        phoneOtpExpires: 1,
        phoneOtpAttempts: 1,
      },
    });
    if (!updated) throw new ApiError(404, 'User not found');
    return this.toPublicAccount(updated);
  }

  async createSession(params: {
    userId: string;
    refreshToken: string;
    deviceName?: string;
    userAgent?: string;
    ip?: string;
  }): Promise<void> {
    await AuthSession.create({
      userId: params.userId,
      refreshTokenHash: hashToken(params.refreshToken),
      deviceName: params.deviceName?.trim() || 'Device',
      userAgent: params.userAgent,
      ip: params.ip,
      lastActiveAt: new Date(),
    });
  }

  async touchSessionByRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await AuthSession.updateOne(
      { userId, refreshTokenHash: hashToken(refreshToken) },
      { $set: { lastActiveAt: new Date() } }
    ).exec();
  }

  async listSessions(userId: string, currentRefreshToken?: string) {
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;
    const sessions = await AuthSession.find({ userId })
      .select('+refreshTokenHash')
      .sort({ lastActiveAt: -1 })
      .limit(40)
      .exec();

    return sessions.map((s) => ({
      id: String(s._id),
      deviceName: s.deviceName,
      userAgent: s.userAgent,
      ip: s.ip,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: currentHash ? s.refreshTokenHash === currentHash : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await AuthSession.deleteOne({ _id: sessionId, userId }).exec();
    if (result.deletedCount === 0) {
      throw new ApiError(404, 'Session not found');
    }
  }

  async revokeOtherSessions(userId: string, keepRefreshToken?: string): Promise<number> {
    const filter: Record<string, unknown> = { userId };
    if (keepRefreshToken) {
      filter.refreshTokenHash = { $ne: hashToken(keepRefreshToken) };
    }
    const result = await AuthSession.deleteMany(filter).exec();
    return result.deletedCount ?? 0;
  }

  async softDeleteAccount(userId: string, password: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    const withPassword = await userRepository.findByEmail(user.email, true);
    if (!withPassword?.password) throw new ApiError(404, 'User not found');

    const ok = await bcrypt.compare(password, withPassword.password);
    if (!ok) throw new ApiError(400, 'Password is incorrect');

    await userRepository.updateById(userId, {
      $set: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
    await AuthSession.deleteMany({ userId }).exec();
  }

  async exportAccountData(userId: string) {
    const account = await this.getAccount(userId);
    const tickets = await Ticket.find({ user: userId })
      .select(
        'ticketNumber title status priority category district taluk city createdAt updatedAt resolvedAt'
      )
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();

    return {
      exportedAt: new Date().toISOString(),
      profile: account,
      tickets: tickets.map((t) => ({
        ticketNumber: t.ticketNumber,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.category,
        district: t.district,
        taluk: t.taluk,
        city: t.city,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        resolvedAt: t.resolvedAt,
      })),
    };
  }

  async addAddress(
    userId: string,
    input: {
      label: string;
      street?: string;
      villageTown?: string;
      taluk?: string;
      district?: string;
      isDefault?: boolean;
    }
  ): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    if (input.isDefault) {
      (user.savedAddresses ?? []).forEach((a) => {
        a.isDefault = false;
      });
    }

    user.savedAddresses = user.savedAddresses ?? [];
    user.savedAddresses.push({
      label: input.label.trim(),
      street: input.street?.trim(),
      villageTown: input.villageTown?.trim(),
      taluk: input.taluk?.trim(),
      district: input.district?.trim(),
      isDefault: Boolean(input.isDefault),
    } as any);

    await user.save();
    return this.toPublicAccount(user);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    input: Partial<{
      label: string;
      street: string;
      villageTown: string;
      taluk: string;
      district: string;
      isDefault: boolean;
    }>
  ): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    const address = (user.savedAddresses ?? []).find((a) => String(a._id) === addressId);
    if (!address) throw new ApiError(404, 'Address not found');

    if (input.label !== undefined) address.label = input.label.trim();
    if (input.street !== undefined) address.street = input.street.trim();
    if (input.villageTown !== undefined) address.villageTown = input.villageTown.trim();
    if (input.taluk !== undefined) address.taluk = input.taluk.trim();
    if (input.district !== undefined) address.district = input.district.trim();
    if (input.isDefault === true) {
      (user.savedAddresses ?? []).forEach((a) => {
        a.isDefault = String(a._id) === addressId;
      });
    } else if (input.isDefault === false) {
      address.isDefault = false;
    }

    await user.save();
    return this.toPublicAccount(user);
  }

  async removeAddress(userId: string, addressId: string): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    user.savedAddresses = (user.savedAddresses ?? []).filter(
      (a) => String(a._id) !== addressId
    );
    await user.save();
    return this.toPublicAccount(user);
  }

  async addFamilyMember(
    userId: string,
    input: {
      name: string;
      relation: string;
      phone?: string;
      district?: string;
      notes?: string;
    }
  ): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    user.familyMembers = user.familyMembers ?? [];
    user.familyMembers.push({
      name: input.name.trim(),
      relation: input.relation.trim(),
      phone: input.phone?.trim(),
      district: input.district?.trim(),
      notes: input.notes?.trim(),
    } as any);
    await user.save();
    return this.toPublicAccount(user);
  }

  async updateFamilyMember(
    userId: string,
    memberId: string,
    input: Partial<{
      name: string;
      relation: string;
      phone: string;
      district: string;
      notes: string;
    }>
  ): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    const member = (user.familyMembers ?? []).find((m) => String(m._id) === memberId);
    if (!member) throw new ApiError(404, 'Family member not found');

    if (input.name !== undefined) member.name = input.name.trim();
    if (input.relation !== undefined) member.relation = input.relation.trim();
    if (input.phone !== undefined) member.phone = input.phone.trim();
    if (input.district !== undefined) member.district = input.district.trim();
    if (input.notes !== undefined) member.notes = input.notes.trim();

    await user.save();
    return this.toPublicAccount(user);
  }

  async removeFamilyMember(userId: string, memberId: string): Promise<PublicAccount> {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    user.familyMembers = (user.familyMembers ?? []).filter(
      (m) => String(m._id) !== memberId
    );
    await user.save();
    return this.toPublicAccount(user);
  }
}

export const accountService = new AccountService();
