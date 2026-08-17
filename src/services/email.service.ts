import nodemailer, { Transporter } from 'nodemailer';
import { canLogOtpWithoutSmtp, env, isSmtpConfigured } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/ApiError';
import {
  renderPasswordResetOtpEmail,
  renderStaffInvitationEmail,
  renderTicketClosureReceiptEmail,
  StaffInvitationTemplateVars,
  TicketClosureReceiptTemplateVars,
} from '../templates/email.templates';

let transporter: Transporter | null = null;
let smtpReady = false;
let initPromise: Promise<boolean> | null = null;

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
    const transport = getTransporter();
    await transport.verify();
    smtpReady = true;
    logger.info(`SMTP ready (${env.SMTP_HOST}:${env.SMTP_PORT})`);
    return true;
  } catch (error) {
    smtpReady = false;
    logger.error('SMTP connection failed. Check SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env', {
      message: formatError(error),
    });
    return false;
  }
}

export async function ensureSmtpReady(): Promise<void> {
  if (smtpReady && transporter) return;

  if (!initPromise) {
    initPromise = verifySmtpConnection().finally(() => {
      initPromise = null;
    });
  }

  const ok = await initPromise;
  if (!ok) {
    throw new Error('SMTP is not available');
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

export async function sendTicketClosureReceiptEmail(
  to: string,
  vars: TicketClosureReceiptTemplateVars
): Promise<void> {
  if (!to || !to.includes('@')) {
    logger.warn(`Ticket closure receipt skipped for invalid email: ${to}`);
    return;
  }

  const { subject, text, html } = renderTicketClosureReceiptEmail(vars);

  if (!isSmtpConfigured()) {
    if (canLogOtpWithoutSmtp()) {
      logger.warn(`[RECEIPT] SMTP not configured — ticket receipt logged only for ${to}`);
      logger.info(`[RECEIPT] ${subject} | ${text}`);
      return;
    }
    throw new ApiError(
      503,
      'Ticket receipt email is not available. The server administrator must configure SMTP.'
    );
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"TVK Support" <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
      headers: {
        'X-TVK-Ticket-Receipt': vars.ticketNumber,
      },
    });
    logger.info(`Ticket closure receipt email accepted by SMTP for ${to}`, {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error) {
    logger.error('SMTP sendMail failed for ticket receipt', {
      email: to,
      message: formatError(error),
    });
    throw new ApiError(503, 'Failed to send ticket receipt email. Please try again later.');
  }
}

export async function sendStaffInvitationEmail(
  to: string,
  vars: StaffInvitationTemplateVars
): Promise<void> {
  const invitee = to.toLowerCase().trim();
  if (!invitee.includes('@')) {
    throw new ApiError(400, 'Invalid invitee email address');
  }

  const { subject, text, html } = renderStaffInvitationEmail(vars);

  if (!isSmtpConfigured()) {
    if (canLogOtpWithoutSmtp()) {
      logger.warn(
        `[INVITE] SMTP not configured — invitation for invitee ${invitee} logged only. ` +
          `token=${vars.token}${vars.acceptUrl ? ` url=${vars.acceptUrl}` : ''}`
      );
      return;
    }
    throw new ApiError(
      503,
      'Invitation email is not available. The server administrator must configure SMTP.'
    );
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"TVK Support" <${env.SMTP_FROM_EMAIL}>`,
      to: invitee,
      subject,
      text,
      html,
      headers: {
        'X-TVK-Invitee': invitee,
      },
    });
    logger.info(`Staff invitation email accepted by SMTP for invitee ${invitee}`, {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
    if (Array.isArray(info.rejected) && info.rejected.length > 0) {
      throw new ApiError(503, `Invitation email was rejected for ${invitee}`);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('SMTP sendMail failed for invitation', {
      email: invitee,
      message: formatError(error),
    });
    throw new ApiError(503, 'Failed to send invitation email. Please try again later.');
  }
}
