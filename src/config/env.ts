import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5001),
  HOST: z.string().default('0.0.0.0'),
  LAN_IP: z.string().default('192.168.1.16'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(5242880),
  SWAGGER_SERVER_URL: z.string().default('http://localhost:5001'),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:support@tvk.com'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM_EMAIL: z.string().default(''),
  /** Public URL used in invitation emails (token is appended as ?token=). */
  INVITE_ACCEPT_URL: z.string().default(''),
  /** When true, log OTP to server console if SMTP is not configured (local testing only). */
  SMTP_LOG_OTP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /**
   * Optional OpenAI-compatible chat.
   * Default: Groq free cloud OSS models (no card). Set OPENAI_API_KEY or GROQ_API_KEY.
   * Get a free key in ~1 min: https://console.groq.com/keys
   */
  OPENAI_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  OPENAI_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),
  OPENAI_MODEL: z.string().default('llama-3.1-8b-instant'),
  // SMS / OTP settings
  SMS_PROVIDER: z.string().default('twilio'),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_FROM_NUMBER: z.string().optional().default(''),
  OTP_TTL_MINUTES: z.coerce.number().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  /** Bearer token required by Vercel cron `/api/cron/overdue`. */
  CRON_SECRET: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export function isSmtpConfigured(): boolean {
  return Boolean(
    env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASSWORD &&
      env.SMTP_FROM_EMAIL &&
      env.SMTP_PASSWORD !== 'your-app-password' &&
      env.SMTP_USER !== 'your-email@gmail.com'
  );
}

/** Log OTP to console instead of email when SMTP is missing (dev / SMTP_LOG_OTP=true). */
export function canLogOtpWithoutSmtp(): boolean {
  return env.NODE_ENV === 'development' || env.SMTP_LOG_OTP;
}

export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

/** Resolves Groq or OpenAI-compatible API key. */
export function getChatApiKey(): string {
  const key = env.OPENAI_API_KEY.trim() || env.GROQ_API_KEY.trim();
  if (!key || key === 'your-openai-api-key' || key === 'your-groq-api-key') {
    return '';
  }
  return key;
}

/** Providers that allow anonymous free cloud inference (no key). */
export function isAnonymousCloudAi(): boolean {
  return env.OPENAI_BASE_URL.toLowerCase().includes('pollinations.ai');
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getChatApiKey()) || isAnonymousCloudAi();
}

export function getChatProviderLabel(): 'pollinations' | 'groq' | 'openai' | 'fallback' {
  if (!isOpenAiConfigured()) return 'fallback';
  const base = env.OPENAI_BASE_URL.toLowerCase();
  if (base.includes('pollinations.ai')) return 'pollinations';
  if (base.includes('groq.com')) return 'groq';
  return 'openai';
}

function isLocalDevHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '10.0.2.2' ||
    hostname === env.LAN_IP ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (corsOrigins.includes(origin) || corsOrigins.includes('*')) return true;
  try {
    const hostname = new URL(origin).hostname;
    // Flutter web uses random localhost ports — always allow same-machine origins.
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (env.NODE_ENV !== 'development') return false;
    return isLocalDevHostname(hostname);
  } catch {
    return false;
  }
}

/** Reflect request origin for Flutter web (random ports) and native clients (no Origin). */
export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (isAllowedCorsOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Not allowed by CORS: ${origin}`));
}
