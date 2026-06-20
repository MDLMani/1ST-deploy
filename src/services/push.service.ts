import webpush from 'web-push';
import { env } from '../config/env';
import { pushSubscriptionRepository } from '../repositories/pushSubscription.repository';
import { renderPushTemplate, type PushTemplateId, type PushTemplateVars } from '../templates/push.templates';
import { logger } from '../utils/logger';

let pushConfigured = false;

export function initWebPush(): boolean {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    logger.warn('Web Push disabled: VAPID keys not configured');
    return false;
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  pushConfigured = true;
  logger.info('Web Push configured (open-source web-push)');
  return true;
}

export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export function isPushEnabled(): boolean {
  return pushConfigured;
}

export async function sendPushToUser(
  userId: string,
  templateId: PushTemplateId,
  vars: PushTemplateVars,
  ticketId?: string
) {
  if (!pushConfigured) return;

  const subscriptions = await pushSubscriptionRepository.findByUserId(userId);
  if (subscriptions.length === 0) return;

  const rendered = renderPushTemplate(templateId, vars);
  const url = ticketId ? `/tickets/${ticketId}` : rendered.url;

  const payload = JSON.stringify({
    title: rendered.title,
    body: rendered.body,
    url,
    templateId,
    icon: '/favicon.svg',
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await pushSubscriptionRepository.deleteByEndpointOnly(sub.endpoint);
        }
        logger.warn('Push delivery failed', { endpoint: sub.endpoint, statusCode });
      }
    })
  );
}
