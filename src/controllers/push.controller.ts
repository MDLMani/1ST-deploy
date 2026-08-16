import { Response } from 'express';
import { pushSubscriptionRepository } from '../repositories/pushSubscription.repository';
import { getVapidPublicKey, isPushEnabled } from '../services/push.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { PushSubscribeInput, PushUnsubscribeInput } from '../validators/push.validators';
import { sendPushToUser } from '../services/push.service';
import { deviceTokenRepository as deviceRepo } from '../repositories/deviceToken.repository';
import { sendFcmToUser } from '../services/fcm.service';

export const getVapidKey = asyncHandler(async (_req, res: Response) => {
  const publicKey = getVapidPublicKey();
  sendSuccess(res, 'VAPID public key', {
    publicKey,
    enabled: isPushEnabled(),
  });
});

export const subscribe = asyncHandler(async (req, res: Response) => {
  const { endpoint, keys } = req.body as PushSubscribeInput;
  const userAgent = req.headers['user-agent'];

  const subscription = await pushSubscriptionRepository.upsert(
    req.user!.userId,
    endpoint,
    keys,
    userAgent
  );

  sendSuccess(res, 'Push subscription saved', { id: subscription._id }, 201);
});

export const unsubscribe = asyncHandler(async (req, res: Response) => {
  const { endpoint } = req.body as PushUnsubscribeInput;
  await pushSubscriptionRepository.deleteByEndpoint(req.user!.userId, endpoint);
  sendSuccess(res, 'Push subscription removed');
});

export const sendTestPush = asyncHandler(async (req, res: Response) => {
  const userId = req.user!.userId;
  await sendPushToUser(userId, 'TICKET_UPDATED', { ticketNumber: 'TEST', status: 'TEST' });
  sendSuccess(res, 'Test push queued');
});

export const registerDevice = asyncHandler(async (req, res: Response) => {
  const { token, platform } = req.body as { token: string; platform?: string };
  await deviceRepo.upsert(req.user!.userId, token, platform ?? 'android');
  sendSuccess(res, 'Device registered');
});

export const unregisterDevice = asyncHandler(async (req, res: Response) => {
  const { token } = req.body as { token: string };
  await deviceRepo.deleteByToken(req.user!.userId, token);
  sendSuccess(res, 'Device unregistered');
});

export const sendTestFcm = asyncHandler(async (req, res: Response) => {
  const userId = req.user!.userId;
  await sendFcmToUser(userId, { title: 'TVK Test', body: 'FCM test message' }, { test: '1' });
  sendSuccess(res, 'FCM test sent');
});
