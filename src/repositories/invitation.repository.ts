import { FilterQuery, UpdateQuery } from 'mongoose';
import { Invitation, IInvitation } from '../models/Invitation.model';

const POPULATE = [
  { path: 'department', select: 'name slug' },
  { path: 'reportingManager', select: 'name email role' },
  { path: 'invitedBy', select: 'name email role' },
  { path: 'approvedBy', select: 'name email role' },
  { path: 'user', select: 'name email role isActive firstName lastName phone jobTitle' },
];

export class InvitationRepository {
  async create(data: Partial<IInvitation>): Promise<IInvitation> {
    const created = await Invitation.create(data);
    return this.findById(created._id.toString()) as Promise<IInvitation>;
  }

  async findById(id: string, includeToken = false): Promise<IInvitation | null> {
    const query = Invitation.findById(id);
    if (includeToken) query.select('+tokenHash');
    return query.populate(POPULATE).exec();
  }

  async findByTokenHash(tokenHash: string): Promise<IInvitation | null> {
    return Invitation.findOne({ tokenHash }).select('+tokenHash').populate(POPULATE).exec();
  }

  async findOpenByEmail(organizationId: string, email: string): Promise<IInvitation | null> {
    return Invitation.findOne({
      organizationId,
      email: email.toLowerCase(),
      invitationStatus: { $in: ['sent', 'accepted'] },
      approvalStatus: {
        $in: ['pending', 'keep_pending', 'awaiting_profile', 'profile_submitted'],
      },
    }).exec();
  }

  async findByOrg(
    organizationId: string,
    filter: FilterQuery<IInvitation> = {}
  ): Promise<IInvitation[]> {
    return Invitation.find({ organizationId, ...filter })
      .populate(POPULATE)
      .sort({ invitedAt: -1 })
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<IInvitation>): Promise<IInvitation | null> {
    await Invitation.findByIdAndUpdate(id, data, { new: true }).exec();
    return this.findById(id);
  }

  async expireStale(organizationId: string): Promise<number> {
    const result = await Invitation.updateMany(
      {
        organizationId,
        invitationStatus: 'sent',
        expiresAt: { $lt: new Date() },
      },
      { $set: { invitationStatus: 'expired' } }
    ).exec();
    return result.modifiedCount;
  }
}

export const invitationRepository = new InvitationRepository();
