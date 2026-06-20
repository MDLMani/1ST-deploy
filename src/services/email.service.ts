import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env';
import { logger } from '../utils/logger';
import { renderPasswordResetOtpEmail } from '../templates/email.templates';

let transporter: Transporter | null = null;
let smtpReady = false;
let initPromise: Promise<boolean> | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT === 587,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

function resetTransporter() {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
  smtpReady = false;
}

/** Warm SMTP pool at startup — avoids first-request cold connection failure */
export async function initSmtp(): Promise<boolean> {
  if (!isSmtpConfigured()) {
    logger.warn(
      'SMTP is not configured. Password reset emails will not be sent. Set SMTP_* vars in .env (see .env.example).'
    );
    return false;
  }

  try {
    const transport = getTransporter();
    await transport.verify();
    smtpReady = true;
    logger.info(`SMTP ready (${env.SMTP_HOST}:${env.SMTP_PORT})`);
    return true;
  } catch (error) {
    smtpReady = false;
    logger.error('SMTP connection failed. Check SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env', {
      error,
    });
    return false;
  }
}

export async function ensureSmtpReady(): Promise<void> {
  if (smtpReady && transporter) return;

  if (!initPromise) {
    initPromise = initSmtp().finally(() => {
      initPromise = null;
    });
  }

  const ok = await initPromise;
  if (!ok) {
    throw new Error('SMTP is not available');
  }
}

/** @deprecated Use initSmtp — kept for compatibility */
export const verifySmtpConnection = initSmtp;

async function sendMailWithRetry(mail: SendMailOptions, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await ensureSmtpReady();
      const info = await getTransporter().sendMail(mail);
      smtpReady = true;
      return info;
    } catch (error) {
      lastError = error;
      smtpReady = false;
      resetTransporter();

      if (attempt < attempts - 1) {
        logger.warn(`SMTP send attempt ${attempt + 1} failed, retrying...`, { error });
        await delay(400 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

export async function sendPasswordResetOtp(to: string, otp: string, name: string): Promise<void> {
  const { subject, text, html } = renderPasswordResetOtpEmail({ name, otp });

  if (!isSmtpConfigured()) {
    if (env.NODE_ENV === 'development') {
      logger.warn(`[DEV] SMTP not configured — OTP for ${to}: ${otp}`);
      return;
    }
    throw new Error('Email service is not configured');
  }

  const info = await sendMailWithRetry({
    from: `"TVK Support" <${env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
    priority: 'high',
  });

  logger.info(`Password reset OTP email sent to ${to}`, {
    messageId: info.messageId,
    accepted: info.accepted,
  });
}
