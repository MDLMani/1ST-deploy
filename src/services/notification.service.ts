import { notificationRepository } from '../repositories/notification.repository';
import { ApiError } from '../utils/ApiError';
import { Types } from 'mongoose';
import { sendPushToUser } from './push.service';
import type { PushTemplateId, PushTemplateVars } from '../templates/push.templates';
import { renderPushTemplate } from '../templates/push.templates';

export class NotificationService {
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    return notificationRepository.findByUserId(userId, page, limit);
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await notificationRepository.markAsRead(notificationId, userId);
    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }
    return notification;
  }

  async markAllAsRead(userId: string) {
    await notificationRepository.markAllAsRead(userId);
  }

  async notifyAdmins(title: string, message: string, adminIds: string[]) {
    if (adminIds.length === 0) return;

    const notifications = adminIds.map((adminId) => ({
      user: new Types.ObjectId(adminId),
      title,
      message,
      read: false,
    }));

    await notificationRepository.createMany(notifications);
  }

  /** In-app notification + open-source Web Push from template */
  async notifyUser(
    userId: string,
    templateId: PushTemplateId,
    vars: PushTemplateVars,
    ticketId?: string
  ) {
    const rendered = renderPushTemplate(templateId, vars);

    await notificationRepository.create({
      user: new Types.ObjectId(userId),
      title: rendered.title,
      message: rendered.body,
      read: false,
    });

    await sendPushToUser(userId, templateId, vars, ticketId);
  }
}

export const notificationService = new NotificationService();
