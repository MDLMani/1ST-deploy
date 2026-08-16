import { FilterQuery, UpdateQuery } from 'mongoose';
import { User, IUser } from '../models/User.model';
import { DEFAULT_ORGANIZATION_ID, UserRole } from '../constants';

export function organizationFilter(organizationId: string): FilterQuery<IUser> {
  if (organizationId === DEFAULT_ORGANIZATION_ID) {
    return {
      $or: [
        { organizationId: DEFAULT_ORGANIZATION_ID },
        { organizationId: { $exists: false } },
        { organizationId: null },
      ],
    };
  }
  return { organizationId };
}

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

  async findByEmailWithResetOtp(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() })
      .select('+password +resetOtpHash +resetOtpExpires +resetOtpAttempts')
      .exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id)
      .populate('department', 'name slug')
      .populate('reportingManager', 'name email role')
      .exec();
  }

  async findByRole(role: UserRole): Promise<IUser[]> {
    return User.find({ role }).exec();
  }

  async findAgentsAndAdmins(): Promise<IUser[]> {
    return User.find({
      role: { $in: [UserRole.ADMIN, UserRole.SUPPORT_AGENT] },
      isActive: { $ne: false },
    }).exec();
  }

  async findActiveAgentsByDepartment(departmentId: string): Promise<IUser[]> {
    return User.find({
      role: { $in: [UserRole.ADMIN, UserRole.SUPPORT_AGENT] },
      department: departmentId,
      isActive: { $ne: false },
    }).exec();
  }

  async updateById(id: string, data: UpdateQuery<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async setPasswordResetOtp(
    id: string,
    resetOtpHash: string,
    resetOtpExpires: Date
  ): Promise<void> {
    await User.findByIdAndUpdate(id, {
      $set: {
        resetOtpHash,
        resetOtpExpires,
        resetOtpAttempts: 0,
      },
    }).exec();
  }

  async findAll(filter: FilterQuery<IUser> = {}): Promise<IUser[]> {
    return User.find(filter).exec();
  }

  async findStaffByOrganization(organizationId: string): Promise<IUser[]> {
    return User.find({
      ...organizationFilter(organizationId),
      role: { $in: [UserRole.ADMIN, UserRole.SUPPORT_AGENT] },
    })
      .populate('department', 'name slug')
      .populate('reportingManager', 'name email role')
      .sort({ name: 1 })
      .exec();
  }

  async findByIdInOrg(id: string, organizationId: string): Promise<IUser | null> {
    return User.findOne({ _id: id, ...organizationFilter(organizationId) }).exec();
  }
}

export const userRepository = new UserRepository();
