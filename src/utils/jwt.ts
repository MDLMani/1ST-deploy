import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { IAuthTokens, IJwtPayload } from '../interfaces';
import { UserRole } from '../constants';

const accessSignOptions: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
};

const refreshSignOptions: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
};

export const generateAccessToken = (payload: IJwtPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, accessSignOptions);
};

export const generateRefreshToken = (payload: IJwtPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, refreshSignOptions);
};

export const generateTokens = (
  userId: string,
  email: string,
  role: UserRole
): IAuthTokens => {
  const payload: IJwtPayload = { userId, email, role };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const verifyAccessToken = (token: string): IJwtPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as IJwtPayload;
};

export const verifyRefreshToken = (token: string): IJwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as IJwtPayload;
};
