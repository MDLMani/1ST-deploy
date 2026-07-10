import nodemailer from 'nodemailer';
import { canLogOtpWithoutSmtp, env, isSmtpConfigured } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/ApiError';
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

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function verifySmtpConnection(): Promise<boolean> {
  if (!isSmtpConfigured()) {
    if (canLogOtpWithoutSmtp()) {
      logger.warn(
        'SMTP is not configured. Password reset OTPs will be logged to the server console (development / SMTP_LOG_OTP).'
      );
    } else {
      logger.warn(
        'SMTP is not configured. Password reset will return 503 until SMTP_* vars are set (see .env.example).'
      );
    }
    return false;
  }

  try {
    await getTransporter().verify();
    logger.info(`SMTP ready (${env.SMTP_HOST}:${env.SMTP_PORT})`);
    return true;
  } catch (error) {
    logger.error('SMTP connection failed. Check SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env', {
      message: formatError(error),
    });
    return false;
  }
}

export async function sendPasswordResetOtp(to: string, otp: string, name: string): Promise<void> {
  const { subject, text, html } = renderPasswordResetOtpEmail({ name, otp });

  if (!isSmtpConfigured()) {
    if (canLogOtpWithoutSmtp()) {
      logger.warn(`[OTP] Password reset code for ${to}: ${otp}`);
      return;
    }

    throw new ApiError(
      503,
      'Password reset email is not available. The server administrator must configure SMTP.'
    );
  }

  try {
    await getTransporter().sendMail({
      from: `"TVK Support" <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
    });

    logger.info(`Password reset OTP email accepted by SMTP for ${to}`);
  } catch (error) {
    logger.error('SMTP sendMail failed', { email: to, message: formatError(error) });
    throw new ApiError(
      503,
      'Failed to send reset email. Verify SMTP credentials (use a Gmail App Password if using Google).'
    );
  }
}
