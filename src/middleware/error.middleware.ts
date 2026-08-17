import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ApiError) {
    sendError(res, err.message, err.statusCode, err.meta);
    return;
  }

  if (err.name === 'ValidationError') {
    sendError(res, err.message, 400);
    return;
  }

  if (err.name === 'CastError') {
    const castErr = err as Error & { path?: string; value?: unknown };
    const detail =
      castErr.path != null
        ? ` (${castErr.path}: ${String(castErr.value ?? '')})`
        : '';
    sendError(res, `Invalid ID format${detail}`, 400);
    return;
  }

  if (err instanceof SyntaxError) {
    const bodyParserErr = err as SyntaxError & { status?: number; type?: string };
    if (bodyParserErr.status === 400 && bodyParserErr.type === 'entity.parse.failed') {
      sendError(res, 'Invalid JSON in request body', 400);
      return;
    }
  }

  if (err.name === 'MongoServerError' && (err as { code?: number }).code === 11000) {
    sendError(res, 'Email already registered', 409);
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  sendError(res, 'Internal server error', 500);
};
