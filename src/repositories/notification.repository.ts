import { Notification, INotification } from '../models/Notification.model';
import { Types } from 'mongoose';

export class NotificationRepository {
  async create(data: Partial<INotification>): Promise<INotification> {
    return Notification.create(data);
  }

  async createMany(data: Partial<INotification>[]): Promise<INotification[]> {
    return Notification.insertMany(data) as unknown as INotification[];
  }

  async findByUserId(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ notifications: INotification[]; total: number }> {
    const skip = (page - 1) * limit;
    const filter = { user: new Types.ObjectId(userId) };

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      Notification.countDocuments(filter).exec(),
    ]);

    return { notifications, total };
  }

  async markAsRead(id: string, userId: string): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { read: true },
      { new: true }
    ).exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany({ user: userId, read: false }, { read: true }).exec();
  }
}

export const notificationRepository = new NotificationRepository();
