import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDatabase } from '../../src/config/database';
import { runOverdueReminderCheck } from '../../src/jobs/overdueReminder.job';
import { env } from '../../src/config/env';

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
    const result = await runOverdueReminderCheck();
    return res.json({
      success: true,
      message: 'Overdue check completed',
      data: result,
    });
  } catch (error) {
    console.error('Overdue cron failed', error);
    return res.status(500).json({
      success: false,
      message: 'Overdue check failed',
    });
  }
}
