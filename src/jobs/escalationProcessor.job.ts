import cron from 'node-cron';
import { escalationService } from '../services/escalation.service';
import { cronLogger } from '../utils/logger';

export const startEscalationProcessorJob = (): void => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    cronLogger.info('Starting escalation processing');
    try {
      await escalationService.processEscalations();
      cronLogger.info('Escalation processing completed');
    } catch (error) {
      cronLogger.error('Escalation processor job failed', { error });
    }
  });

  cronLogger.info('Escalation processor cron job scheduled (every 5 minutes)');
};
