import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app';
import { connectDatabase } from '../src/config/database';
import { initWebPush } from '../src/services/push.service';
import { initFirebase } from '../src/services/fcm.service';
import { departmentService } from '../src/services/department.service';
import { ensureDefaultAdmin } from '../src/services/defaultAdmin.service';

let isReady = false;
let bootstrapPromise: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  if (isReady) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await connectDatabase();
      await ensureDefaultAdmin();
      initWebPush();
      initFirebase();
      void departmentService.ensureSeeded().catch((error) => {
        console.warn('Department seed skipped', error);
      });
      isReady = true;
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.url ?? '').split('?')[0];
  if (path === '/health' || path === '/api/v1/health') {
    return res.status(200).json({
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
