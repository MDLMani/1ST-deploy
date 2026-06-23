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
    sendError(res, 'Invalid ID format', 400);
    return;
  }

  const parseError = err as SyntaxError & { status?: number; type?: string };
  if (err instanceof SyntaxError && parseError.status === 400 && parseError.type === 'entity.parse.failed') {
    sendError(res, 'Invalid JSON in request body', 400);
    return;
  }

  if (err.name === 'MongoServerError' && (err as { code?: number }).code === 11000) {
    sendError(res, 'Email already registered', 409);
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  sendError(res, 'Internal server error', 500);
};
