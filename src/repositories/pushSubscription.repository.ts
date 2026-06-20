import { PushSubscription, IPushSubscription } from '../models/PushSubscription.model';
import { Types } from 'mongoose';

export class PushSubscriptionRepository {
  async upsert(
    userId: string,
    endpoint: string,
    keys: { p256dh: string; auth: string },
    userAgent?: string
  ): Promise<IPushSubscription> {
    return PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: new Types.ObjectId(userId),
        endpoint,
        keys,
        userAgent,
      },
      { upsert: true, new: true }
    ).exec() as Promise<IPushSubscription>;
  }

  async findByUserId(userId: string): Promise<IPushSubscription[]> {
    return PushSubscription.find({ user: userId }).exec();
  }

  async deleteByEndpoint(userId: string, endpoint: string): Promise<boolean> {
    const result = await PushSubscription.deleteOne({ user: userId, endpoint }).exec();
    return result.deletedCount > 0;
  }

  async deleteByEndpointOnly(endpoint: string): Promise<void> {
    await PushSubscription.deleteOne({ endpoint }).exec();
  }
}

export const pushSubscriptionRepository = new PushSubscriptionRepository();
