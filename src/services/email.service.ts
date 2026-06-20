import nodemailer from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env';
import { logger } from '../utils/logger';
import { renderPasswordResetOtpEmail } from '../templates/email.templates';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
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
    });
  }

  return transporter;
}

export async function verifySmtpConnection(): Promise<boolean> {
  if (!isSmtpConfigured()) {
    logger.warn(
      'SMTP is not configured. Password reset emails will not be sent. Set SMTP_* vars in .env (see .env.example).'
    );
    return false;
  }

  try {
    await getTransporter().verify();
    logger.info(`SMTP ready (${env.SMTP_HOST}:${env.SMTP_PORT})`);
    return true;
  } catch (error) {
    logger.error('SMTP connection failed. Check SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env', {
      error,
    });
    return false;
  }
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

  await getTransporter().sendMail({
    from: `"TVK Support" <${env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });

  logger.info(`Password reset OTP email accepted by SMTP for ${to}`);
}
