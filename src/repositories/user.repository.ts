import { FilterQuery, UpdateQuery } from 'mongoose';
import { User, IUser } from '../models/User.model';
import { UserRole } from '../constants';

export class UserRepository {
  async create(data: Partial<IUser>): Promise<IUser> {
    return User.create(data);
  }

  async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
    const query = User.findOne({ email: email.toLowerCase() });
    if (includePassword) {
      query.select('+password');
    }
    return query.exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id).exec();
  }

  async findByRole(role: UserRole): Promise<IUser[]> {
    return User.find({ role }).exec();
  }

  async findAgentsAndAdmins(): Promise<IUser[]> {
    return User.find({
      role: { $in: [UserRole.ADMIN, UserRole.SUPPORT_AGENT] },
    }).exec();
  }

  async updateById(id: string, data: UpdateQuery<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async findAll(filter: FilterQuery<IUser> = {}): Promise<IUser[]> {
    return User.find(filter).exec();
  }
}

export const userRepository = new UserRepository();
