import { Request } from 'express';
import { IJwtPayload } from '../interfaces';

export interface AuthenticatedRequest extends Request {
  user: IJwtPayload;
}
