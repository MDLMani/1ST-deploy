import { DeviceToken, IDeviceToken } from '../models/DeviceToken.model';

export class DeviceTokenRepository {
  async upsert(userId: string, token: string, platform: string): Promise<IDeviceToken> {
    return DeviceToken.findOneAndUpdate(
      { token },
      { user: userId, token, platform },
      { upsert: true, new: true }
    ).exec() as Promise<IDeviceToken>;
  }

  async deleteByToken(userId: string, token: string): Promise<void> {
    await DeviceToken.deleteOne({ user: userId, token }).exec();
  }

  async findByUserId(userId: string): Promise<IDeviceToken[]> {
    return DeviceToken.find({ user: userId }).exec();
  }

  async deleteByTokenOnly(token: string): Promise<void> {
    await DeviceToken.deleteOne({ token }).exec();
  }
}

export const deviceTokenRepository = new DeviceTokenRepository();
