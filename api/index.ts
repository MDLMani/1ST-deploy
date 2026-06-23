import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app';
import { connectDatabase } from '../src/config/database';
import { initWebPush } from '../src/services/push.service';
import { initSmtp } from '../src/services/email.service';

let isReady = false;

async function bootstrap(): Promise<void> {
  if (isReady) {
    return;
  }

  await connectDatabase();
  initWebPush();
  await initSmtp();
  isReady = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.split('?')[0] ?? '';

  if (path === '/health') {
    return res.json({
      success: true,
      message: 'TVK Support API is running',
      data: { status: 'ok' },
    });
  }

  try {
    await bootstrap();
    return app(req, res);
  } catch (error) {
    console.error('API bootstrap failed', error);
    return res.status(500).json({
      success: false,
      message: 'Service temporarily unavailable',
    });
  }
}
