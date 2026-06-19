import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { env, corsOrigins } from './config/env';
import { swaggerSpec } from './config/swagger';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogMiddleware } from './middleware/requestLog.middleware';

const app = express();

// Health check before security middleware — must be reachable from mobile on LAN
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'TVK Support API is running', data: { status: 'ok' } });
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
    },
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogMiddleware);

app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
