import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { initSocketIO } from './sockets';
import { initWebPush } from './services/push.service';
import { initSmtp } from './services/email.service';
import { startOverdueReminderJob } from './jobs/overdueReminder.job';
import { logger } from './utils/logger';

const startServer = async (): Promise<void> => {
  const [, smtpOk] = await Promise.all([connectDatabase(), initSmtp()]);

  if (!smtpOk && env.NODE_ENV === 'development') {
    logger.warn('SMTP warmup skipped or failed — first OTP email may retry automatically');
  }

  initWebPush();

  const httpServer = http.createServer(app);
  initSocketIO(httpServer);
  startOverdueReminderJob();

  httpServer.listen(env.PORT, env.HOST, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`Local:   http://localhost:${env.PORT}`);
    logger.info(`Network: http://${env.LAN_IP}:${env.PORT}`);
    logger.info(`Swagger: http://${env.LAN_IP}:${env.PORT}/api-docs`);
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(
        `Port ${env.PORT} is already in use. Stop the other process or set PORT to a free port in .env (e.g. PORT=5001).`
      );
      process.exit(1);
    }

    logger.error('HTTP server failed to start', { error });
    process.exit(1);
  });

  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
