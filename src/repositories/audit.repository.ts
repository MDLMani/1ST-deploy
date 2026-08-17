import { Types } from 'mongoose';
import { AuditEvent, IAuditEvent } from '../models/AuditEvent.model';

export class AuditRepository {
  async create(data: Partial<IAuditEvent>): Promise<IAuditEvent> {
    return AuditEvent.create(data);
  }

  async findByOrg(organizationId: string, limit = 100): Promise<IAuditEvent[]> {
    return AuditEvent.find({ organizationId })
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findByTarget(targetIds: Array<string | Types.ObjectId>, limit = 50): Promise<IAuditEvent[]> {
    return AuditEvent.find({ targetId: { $in: targetIds } })
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}

export const auditRepository = new AuditRepository();
