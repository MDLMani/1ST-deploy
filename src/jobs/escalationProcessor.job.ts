import cron from 'node-cron';
import { escalationService } from '../services/escalation.service';
import { cronLogger } from '../utils/logger';

export const runEscalationProcessor = async (): Promise<void> => {
  cronLogger.info('Starting escalation processing');
  await escalationService.processEscalations();
  cronLogger.info('Escalation processing completed');
};

export const startEscalationProcessorJob = (): void => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runEscalationProcessor();
    } catch (error) {
      cronLogger.error('Escalation processor job failed', { error });
    }
  });

  cronLogger.info('Escalation processor cron job scheduled (every 5 minutes)');
};
