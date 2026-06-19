import { UserRole } from '../constants';

export interface IJwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
}
