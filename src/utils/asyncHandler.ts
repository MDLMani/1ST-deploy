import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<void>;

export const asyncHandler = <T extends Request = Request>(
  fn: AsyncRequestHandler<T>
): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

export const getRouteParam = (param: string | string[]): string => {
  return Array.isArray(param) ? param[0] : param;
};
