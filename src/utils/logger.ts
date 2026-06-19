import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-be' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
  ],
});

if (env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export const cronLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-cron' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'cron.log'),
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export const requestLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'tvk-support-request' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'request.log'),
    }),
  ],
});
