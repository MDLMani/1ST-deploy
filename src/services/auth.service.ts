import bcrypt from 'bcrypt';
import { IUser } from '../models/User.model';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/ApiError';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { UserRole } from '../constants';
import { RegisterInput, LoginInput } from '../validators';

const SALT_ROUNDS = 12;

type AuthUser = {
  id: IUser['_id'];
  name: string;
  email: string;
  role: UserRole;
};

type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type RegisterResult =
  | (AuthResult & { isExistingUser: false })
  | { isExistingUser: true };

export class AuthService {
  private buildAuthResult(user: IUser): AuthResult {
    const tokens = generateTokens(user._id.toString(), user.email, user.role);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existingUser = await userRepository.findByEmail(input.email, true);
    if (existingUser) {
      const isPasswordValid = await bcrypt.compare(input.password, existingUser.password);
      if (!isPasswordValid) {
        throw new ApiError(409, 'Email already registered');
      }

      return { isExistingUser: true };
    }

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    const role =
      input.role && [UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(input.role)
        ? input.role
        : UserRole.USER;

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role,
    });

    return { isExistingUser: false, ...this.buildAuthResult(user) };
  }

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email, true);
    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    return this.buildAuthResult(user);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        throw new ApiError(401, 'Invalid refresh token');
      }

      return generateTokens(user._id.toString(), user.email, user.role);
    } catch {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }
  }
}

export const authService = new AuthService();
