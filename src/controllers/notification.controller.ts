import { Response } from 'express';
import { notificationService } from '../services/notification.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getNotifications = asyncHandler(async (req, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const { notifications, total } = await notificationService.getUserNotifications(
    req.user!.userId,
    page,
    limit
  );

  sendSuccess(res, 'Notifications retrieved', notifications, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const markAsRead = asyncHandler(async (req, res: Response) => {
  const notification = await notificationService.markAsRead(
    getRouteParam(req.params.id),
    req.user!.userId
  );
  sendSuccess(res, 'Notification marked as read', notification);
});

export const markAllAsRead = asyncHandler(async (req, res: Response) => {
  await notificationService.markAllAsRead(req.user!.userId);
  sendSuccess(res, 'All notifications marked as read');
});
