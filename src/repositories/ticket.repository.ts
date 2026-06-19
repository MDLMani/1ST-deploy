import { FilterQuery, UpdateQuery } from 'mongoose';
import { Ticket, ITicket } from '../models/Ticket.model';
import { TicketStatus } from '../constants';

export interface TicketQueryOptions {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  overdue?: boolean;
}

export class TicketRepository {
  async create(data: Partial<ITicket>): Promise<ITicket> {
    return Ticket.create(data);
  }

  async findById(id: string): Promise<ITicket | null> {
    return Ticket.findById(id)
      .populate('user', 'name email role')
      .populate('assignedTo', 'name email role')
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

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('assignedTo', 'name email role')
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

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('user', 'name email role')
        .populate('assignedTo', 'name email role')
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
      .populate('user', 'name email role')
      .populate('assignedTo', 'name email role')
      .exec();
  }

  async countDocuments(filter: FilterQuery<ITicket> = {}): Promise<number> {
    return Ticket.countDocuments(filter).exec();
  }
}

export const ticketRepository = new TicketRepository();
