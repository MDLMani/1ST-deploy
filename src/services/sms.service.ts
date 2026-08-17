import { env } from '../config/env';
import { phoneVerificationRepository } from '../repositories/phoneVerification.repository';
import { logger } from '../utils/logger';

let twilioClient: any = null;
try {
  // lazy require so tests without Twilio don't fail
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Twilio = require('twilio');
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    twilioClient = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
} catch (_) {
  // optional
}

function generateNumericCode(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

export async function sendVerificationCode(userId: string | null | undefined, phone: string) {
  const code = generateNumericCode(6);
  const ttl = env.OTP_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

  await phoneVerificationRepository.create({ user: userId ?? undefined, phone, code, expiresAt });

  const body = `Your TVK verification code is ${code}. Expires in ${ttl} minutes.`;

  if (env.SMS_PROVIDER === 'twilio' && twilioClient && env.TWILIO_FROM_NUMBER) {
    try {
      await twilioClient.messages.create({ body, from: env.TWILIO_FROM_NUMBER, to: phone });
      logger.info('SMS sent via Twilio', { phone });
      return true;
    } catch (err) {
      logger.warn('Twilio send failed', { err });
      return false;
    }
  }

  // Fallback: log OTP to server console for dev when Twilio missing
  logger.info('OTP (dev) for ' + phone + ': ' + code);
  return true;
}

export async function verifyCode(phone: string, code: string) {
  const active = await phoneVerificationRepository.findActiveByPhone(phone);
  if (!active) return { ok: false, reason: 'not_found' };
  if (active.attempts >= env.OTP_MAX_ATTEMPTS) return { ok: false, reason: 'attempts_exceeded' };
  if (active.code !== code) {
    await phoneVerificationRepository.incrementAttempts(active._id.toString());
    return { ok: false, reason: 'invalid_code' };
  }

  // success — consume codes
  await phoneVerificationRepository.consume(phone);
  return { ok: true };
}
