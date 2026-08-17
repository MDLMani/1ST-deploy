import cron from 'node-cron';
import { slaService } from '../services/sla.service';
import { cronLogger } from '../utils/logger';

export const runSlaMonitorCheck = async (): Promise<void> => {
  cronLogger.info('Starting SLA breach check');
  await slaService.checkBreaches();
  cronLogger.info('SLA breach check completed');
};

export const startSLAMonitorJob = (): void => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runSlaMonitorCheck();
    } catch (error) {
      cronLogger.error('SLA monitor job failed', { error });
    }
  });

  cronLogger.info('SLA monitor cron job scheduled (every 5 minutes)');
};
