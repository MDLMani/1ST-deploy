import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDatabase } from '../../src/config/database';
import { env } from '../../src/config/env';
import { runOverdueReminderCheck } from '../../src/jobs/overdueReminder.job';
import { runSlaMonitorCheck } from '../../src/jobs/slaMonitor.job';
import { runEscalationProcessor } from '../../src/jobs/escalationProcessor.job';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    await connectDatabase();
    const overdue = await runOverdueReminderCheck();
    await runSlaMonitorCheck();
    await runEscalationProcessor();
    return res.json({
      success: true,
      message: 'Scheduled jobs completed',
      data: { overdue },
    });
  } catch (error) {
    console.error('Scheduled jobs failed', error);
    return res.status(500).json({
      success: false,
      message: 'Scheduled jobs failed',
    });
  }
}
