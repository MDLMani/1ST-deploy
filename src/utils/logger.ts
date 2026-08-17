import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { isServerlessRuntime } from '../config/runtime';

const logsDir = path.join(process.cwd(), 'logs');
const useFileLogs = !isServerlessRuntime();

if (useFileLogs) {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (error) {
    console.warn('Log directory unavailable; using console only', error);
  }
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

function createConsoleTransport(): winston.transports.ConsoleTransportInstance {
  return new winston.transports.Console({
    format:
      env.NODE_ENV === 'production'
        ? logFormat
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  });
}

function fileTransports(filename: string, level?: string): winston.transport[] {
  if (!useFileLogs) return [];
  try {
    return [
      new winston.transports.File({
        filename: path.join(logsDir, filename),
        ...(level ? { level } : {}),
      }),
    ];
  } catch {
    return [];
  }
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-be' },
  transports: [
    ...fileTransports('error.log', 'error'),
    ...fileTransports('combined.log'),
    createConsoleTransport(),
  ],
});

export const cronLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-cron' },
  transports: [...fileTransports('cron.log'), createConsoleTransport()],
});

export const requestLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-request' },
  transports: useFileLogs
    ? fileTransports('request.log')
    : [createConsoleTransport()],
});
