import cron from 'node-cron';
import { slaService } from '../services/sla.service';
import { cronLogger } from '../utils/logger';

export const startSLAMonitorJob = (): void => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    cronLogger.info('Starting SLA breach check');
    try {
      await slaService.checkBreaches();
      cronLogger.info('SLA breach check completed');
    } catch (error) {
      cronLogger.error('SLA monitor job failed', { error });
    }
  });

  cronLogger.info('SLA monitor cron job scheduled (every 5 minutes)');
};
