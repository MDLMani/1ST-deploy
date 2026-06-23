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

function getPath(req: VercelRequest): string {
  return req.url?.split('?')[0] ?? '';
}

function handlePublicPath(path: string, res: VercelResponse): boolean {
  if (path === '/health') {
    res.json({
      success: true,
      message: 'TVK Support API is running',
      data: { status: 'ok' },
    });
    return true;
  }

  if (path === '/') {
    res.json({
      success: true,
      message: 'TVK Support Ticket API',
      data: {
        docs: '/api-docs',
        health: '/health',
        api: '/api/v1',
      },
    });
    return true;
  }

  if (path === '/favicon.ico' || path === '/favicon.png') {
    res.status(204).end();
    return true;
  }

  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = getPath(req);

  if (handlePublicPath(path, res)) {
    return;
  }

  try {
    await bootstrap();
    return app(req, res);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('whitelist')
        ? 'Database connection failed. Allow 0.0.0.0/0 in MongoDB Atlas Network Access.'
        : 'Service temporarily unavailable';

    console.error('API bootstrap failed', error);
    return res.status(503).json({
      success: false,
      message,
    });
  }
}
