import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const isVercel = Boolean(process.env.VERCEL);
const logsDir = path.join(process.cwd(), 'logs');

if (!isVercel && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple()
);

function buildTransports(
  files: { filename: string; level?: string }[],
  includeConsole = false
): winston.transport[] {
  if (isVercel) {
    return [new winston.transports.Console({ format: consoleFormat })];
  }

  const transports: winston.transport[] = files.map(
    (file) =>
      new winston.transports.File({
        filename: path.join(logsDir, file.filename),
        level: file.level,
      })
  );

  if (includeConsole || env.NODE_ENV !== 'production') {
    transports.push(new winston.transports.Console({ format: consoleFormat }));
  }

  return transports;
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-be' },
  transports: buildTransports([
    { filename: 'error.log', level: 'error' },
    { filename: 'combined.log' },
  ]),
});

export const cronLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-cron' },
  transports: buildTransports([{ filename: 'cron.log' }], true),
});

export const requestLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-request' },
  transports: buildTransports([{ filename: 'request.log' }]),
});
