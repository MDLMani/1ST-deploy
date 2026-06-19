import { Response } from 'express';
import { IApiResponse } from '../interfaces';

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): Response => {
  const response: IApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  meta?: Record<string, unknown>
): Response => {
  const response: IApiResponse = {
    success: false,
    message,
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(response);
};
