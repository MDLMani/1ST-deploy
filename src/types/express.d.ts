import { Request } from 'express';
import { IJwtPayload } from '../interfaces';

declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: IJwtPayload;
}
