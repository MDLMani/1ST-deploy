import { Response } from 'express';
import { pushSubscriptionRepository } from '../repositories/pushSubscription.repository';
import { getVapidPublicKey, isPushEnabled } from '../services/push.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { PushSubscribeInput, PushUnsubscribeInput } from '../validators/push.validators';

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
