import { FilterQuery, UpdateQuery } from 'mongoose';
import { Ticket, ITicket } from '../models/Ticket.model';
import { TicketStatus } from '../constants';
import { satisfactionRepository } from './satisfaction.repository';

export interface TicketQueryOptions {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  overdue?: boolean;
  department?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  priority?: string;
}

export class TicketRepository {
  async create(data: Partial<ITicket>): Promise<ITicket> {
    return Ticket.create(data);
  }

  async findById(id: string): Promise<ITicket | null> {
    return Ticket.findById(id)
      .populate(
        'user',
        'name email role phone district taluk city party partyRole createdAt isActive'
      )
      .populate('assignedTo', 'name email role')
      .populate('department', 'name slug')
      .exec();
  }

  async findByTicketNumber(ticketNumber: string): Promise<ITicket | null> {
    return Ticket.findOne({ ticketNumber }).exec();
  }

  async findByUserId(
    userId: string,
    options: TicketQueryOptions = {}
  ): Promise<{ tickets: ITicket[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<ITicket> = { user: userId };
    if (options.status) filter.status = options.status;
    if (options.overdue !== undefined) filter.overdue = options.overdue;
    if (options.department) filter.department = options.department;
    if (options.tags && options.tags.length > 0) filter.tags = { $in: options.tags };
    if (options.priority) filter.priority = options.priority;
    if (options.dateFrom || options.dateTo) {
      filter.createdAt = {};
      if (options.dateFrom) filter.createdAt.$gte = options.dateFrom;
      if (options.dateTo) filter.createdAt.$lte = options.dateTo;
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('assignedTo', 'name email role')
        .populate('department', 'name slug')
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Ticket.countDocuments(filter).exec(),
    ]);

    return { tickets, total };
  }

  async findAll(
    options: TicketQueryOptions = {}
  ): Promise<{ tickets: ITicket[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<ITicket> = {};
    if (options.status) filter.status = options.status;
    if (options.overdue !== undefined) filter.overdue = options.overdue;
    if (options.department) filter.department = options.department;
    if (options.tags && options.tags.length > 0) filter.tags = { $in: options.tags };
    if (options.priority) filter.priority = options.priority;
    if (options.dateFrom || options.dateTo) {
      filter.createdAt = {};
      if (options.dateFrom) filter.createdAt.$gte = options.dateFrom;
      if (options.dateTo) filter.createdAt.$lte = options.dateTo;
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('user', 'name email role')
        .populate('assignedTo', 'name email role')
        .populate('department', 'name slug')
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Ticket.countDocuments(filter).exec(),
    ]);

    return { tickets, total };
  }

  async findUnresolved(): Promise<ITicket[]> {
    return Ticket.find({
      status: { $in: ['OPEN', 'IN_PROGRESS'] },
    })
      .populate('user', 'name email')
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<ITicket>): Promise<ITicket | null> {
    return Ticket.findByIdAndUpdate(id, data, { new: true })
      .populate(
        'user',
        'name email role phone district taluk city party partyRole createdAt isActive'
      )
      .populate('assignedTo', 'name email role')
      .populate('department', 'name slug')
      .exec();
  }

  async countDocuments(filter: FilterQuery<ITicket> = {}): Promise<number> {
    return Ticket.countDocuments(filter).exec();
  }

  async getDashboardStats(): Promise<{
    total: number;
    open: number;
    resolved: number;
    overdue: number;
    slaBreaches: number;
    csatAverage: number;
    departmentBreakdown: { name: string; count: number }[];
    priorityDistribution: { name: string; value: number }[];
    statusAnalytics: { name: string; value: number }[];
    trends: { month: string; count: number }[];
    recentTickets: ITicket[];
  }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      total,
      openCount,
      inProgressCount,
      resolvedCount,
      closedCount,
      overdue,
      slaBreaches,
      departmentAgg,
      priorityAgg,
      statusAgg,
      trendsAgg,
      recentTickets,
      csatStats,
    ] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: TicketStatus.OPEN }),
      Ticket.countDocuments({ status: TicketStatus.IN_PROGRESS }),
      Ticket.countDocuments({ status: TicketStatus.RESOLVED }),
      Ticket.countDocuments({ status: TicketStatus.CLOSED }),
      Ticket.countDocuments({ overdue: true }),
      this.countSLABreached(),
      Ticket.aggregate<{ _id: string; count: number }>([
        { $match: { department: { $exists: true, $ne: null } } },
        { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$dept.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Ticket.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate<{ _id: { y: number; m: number }; count: number }>([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      Ticket.find()
        .populate('user', 'name email role')
        .populate('assignedTo', 'name email role')
        .populate('department', 'name slug')
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .limit(12)
        .exec(),
      satisfactionRepository.getCSATStats(),
    ]);

    const priorityMap = Object.fromEntries(priorityAgg.map((p) => [p._id, p.count]));
    const statusMap = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));

    return {
      total,
      open: openCount + inProgressCount,
      resolved: resolvedCount + closedCount,
      overdue,
      slaBreaches,
      csatAverage: csatStats.averageRating,
      departmentBreakdown: departmentAgg.map((d) => ({
        name: d._id ?? 'Unassigned',
        count: d.count,
      })),
      priorityDistribution: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((name) => ({
        name,
        value: priorityMap[name] ?? 0,
      })),
      statusAnalytics: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((name) => ({
        name,
        value: statusMap[name] ?? 0,
      })),
      trends: trendsAgg.map((t) => ({
        month: `${t._id.y}-${String(t._id.m).padStart(2, '0')}`,
        count: t.count,
      })),
      recentTickets,
    };
  }

  async findByDepartment(departmentId: string, options: TicketQueryOptions = {}): Promise<{ tickets: ITicket[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const skip = (page - 1) * limit;
    const filter: FilterQuery<ITicket> = { department: departmentId };
    if (options.status) filter.status = options.status;
    if (options.overdue !== undefined) filter.overdue = options.overdue;
    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('user', 'name email role')
        .populate('assignedTo', 'name email role')
        .populate('department', 'name slug')
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Ticket.countDocuments(filter).exec(),
    ]);
    return { tickets, total };
  }

  async findMergedChildren(parentId: string): Promise<ITicket[]> {
    return Ticket.find({ mergedInto: parentId }).sort({ createdAt: 1 }).exec();
  }

  async countSLABreached(): Promise<number> {
    return Ticket.countDocuments({
      $or: [
        { 'sla.responseBreached': true },
        { 'sla.resolutionBreached': true },
      ],
    }).exec();
  }

  async countActiveSLA(): Promise<number> {
    return Ticket.countDocuments({
      status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
      'sla.responseDeadline': { $exists: true },
    }).exec();
  }

  async getDepartmentBreakdown(): Promise<{ name: string; count: number }[]> {
    const agg = await Ticket.aggregate<{ _id: string; count: number }>([
      { $match: { department: { $exists: true, $ne: null } } },
      { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$dept.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return agg.map((d) => ({ name: d._id ?? 'Unassigned', count: d.count }));
  }

  async countOpenTicketsForAgent(agentId: string): Promise<number> {
    return Ticket.countDocuments({
      assignedTo: agentId,
      status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
    }).exec();
  }

  async getSLABreachedTickets(): Promise<ITicket[]> {
    const now = new Date();
    return Ticket.find({
      status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
      $or: [
        { 'sla.responseDeadline': { $lte: now }, 'sla.responseBreached': false },
        { 'sla.resolutionDeadline': { $lte: now }, 'sla.resolutionBreached': false },
      ],
    }).populate('user', 'name email').populate('assignedTo', 'name email').exec();
  }

  async findByTags(tagIds: string[], options: TicketQueryOptions = {}): Promise<{ tickets: ITicket[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const skip = (page - 1) * limit;
    const filter: FilterQuery<ITicket> = { tags: { $in: tagIds } };
    if (options.status) filter.status = options.status;
    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('user', 'name email role')
        .populate('assignedTo', 'name email role')
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Ticket.countDocuments(filter).exec(),
    ]);
    return { tickets, total };
  }
}

export const ticketRepository = new TicketRepository();
