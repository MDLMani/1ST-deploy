const admin: any = require('firebase-admin');
import { deviceTokenRepository } from '../repositories/deviceToken.repository';
import { logger } from '../utils/logger';

let firebaseInitialized = false;

export function initFirebase() {
  if (firebaseInitialized) return false;
  try {
    const credJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!credJson) {
      logger.warn('Firebase not configured: FIREBASE_SERVICE_ACCOUNT_JSON missing');
      return false;
    }
    const creds = JSON.parse(credJson);
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    firebaseInitialized = true;
    logger.info('Firebase admin initialized');
    return true;
  } catch (err) {
    logger.warn('Firebase init failed', { err });
    return false;
  }
}

export async function sendFcmToUser(userId: string, notification: { title: string; body: string }, data?: Record<string, string>) {
  if (!firebaseInitialized) return;
  const tokens = await deviceTokenRepository.findByUserId(userId);
  if (!tokens || tokens.length === 0) return;

  const registrationTokens = tokens.map((t) => t.token);
  try {
    const message: any = {
      notification: notification,
      data: data ?? {},
      tokens: registrationTokens,
    };
    const resp = await admin.messaging().sendMulticast(message);
    if (resp.failureCount > 0) {
      resp.responses.forEach((r: any, idx: number) => {
        if (!r.success) {
          const bad = registrationTokens[idx];
          logger.warn('FCM send failed', { token: bad, err: r.error });
          // remove invalid token
          if ((r.error as any)?.code === 'messaging/registration-token-not-registered') {
            deviceTokenRepository.deleteByTokenOnly(bad).catch(() => {});
          }
        }
      });
    }
  } catch (err) {
    logger.warn('FCM send error', { err });
  }
}
