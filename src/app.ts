import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env, corsOriginDelegate } from './config/env';
import { swaggerSpec } from './config/swagger';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogMiddleware } from './middleware/requestLog.middleware';
import { getUploadDir } from './middleware/upload.middleware';

const app = express();
const isDev = env.NODE_ENV === 'development';

if (process.env.VERCEL || env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
  })
);

// After CORS so Flutter web (Chrome) can probe health during ApiConfig init.
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'TVK Support API is running', data: { status: 'ok' } });
});
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, message: 'TVK Support API is running', data: { status: 'ok' } });
});

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: isDev ? 10000 : env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isDev) return true;
    const path = req.originalUrl || req.path;
    return path.includes('/notifications') || path.includes('/refresh-token');
  },
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
  },
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogMiddleware);

app.use('/uploads', express.static(getUploadDir()));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1', apiLimiter);
app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
