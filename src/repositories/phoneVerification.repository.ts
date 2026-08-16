import { PhoneVerification, IPhoneVerification } from '../models/PhoneVerification.model';

export class PhoneVerificationRepository {
  async create(data: Partial<IPhoneVerification>): Promise<IPhoneVerification> {
    return PhoneVerification.create(data as any);
  }

  async findActiveByPhone(phone: string) {
    return PhoneVerification.findOne({ phone, expiresAt: { $gt: new Date() } }).exec();
  }

  async consume(phone: string) {
    await PhoneVerification.deleteMany({ phone }).exec();
  }

  async incrementAttempts(id: string) {
    await PhoneVerification.findByIdAndUpdate(id, { $inc: { attempts: 1 } }).exec();
  }
}

export const phoneVerificationRepository = new PhoneVerificationRepository();
