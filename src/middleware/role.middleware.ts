import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../constants';

export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'Insufficient permissions'));
      return;
    }

    next();
  };

export const staffOnly = authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT);
