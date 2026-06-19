import { ticketRepository, TicketQueryOptions } from '../repositories/ticket.repository';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/ApiError';
import { TicketPriority, TicketStatus, UserRole } from '../constants';
import { IAttachment } from '../interfaces';
import { CreateTicketInput, UpdateStatusInput, AssignTicketInput } from '../validators';
import { getSocketIO } from '../sockets';
import { SOCKET_EVENTS } from '../constants';
import { getTicketOwnerId } from '../utils/ticket.helpers';
import { Types } from 'mongoose';

export class TicketService {
  private async generateTicketNumber(): Promise<string> {
    const count = await ticketRepository.countDocuments();
    const year = new Date().getFullYear();
    return `TVK-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async createTicket(userId: string, input: CreateTicketInput, attachments: IAttachment[] = []) {
    const ticketNumber = await this.generateTicketNumber();

    const ticket = await ticketRepository.create({
      ticketNumber,
      user: new Types.ObjectId(userId),
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority ?? TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      attachments,
      overdue: false,
      reminderCount: 0,
    });

    const populated = await ticketRepository.findById(ticket._id.toString());

    const io = getSocketIO();
    if (io && populated) {
      io.emit(SOCKET_EVENTS.TICKET_CREATED, populated);
    }

    return populated;
  }

  async getUserTickets(userId: string, options: TicketQueryOptions) {
    return ticketRepository.findByUserId(userId, options);
  }

  async getAllTickets(options: TicketQueryOptions) {
    return ticketRepository.findAll(options);
  }

  async getTicketById(ticketId: string, requesterId: string, requesterRole: UserRole) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    const isOwner = getTicketOwnerId(ticket) === requesterId;
    const isStaff = [UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(requesterRole);

    if (!isOwner && !isStaff) {
      throw new ApiError(403, 'Access denied');
    }

    return ticket;
  }

  async updateStatus(
    ticketId: string,
    input: UpdateStatusInput,
    requesterRole: UserRole
  ) {
    if (![UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(requesterRole)) {
      throw new ApiError(403, 'Only staff can update ticket status');
    }

    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    const updateData: Record<string, unknown> = { status: input.status };

    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(input.status)) {
      updateData.overdue = false;
    }

    const updated = await ticketRepository.updateById(ticketId, updateData);
    if (!updated) {
      throw new ApiError(404, 'Ticket not found');
    }

    const io = getSocketIO();
    if (io) {
      io.emit(SOCKET_EVENTS.TICKET_UPDATED, updated);
    }

    return updated;
  }

  async assignTicket(
    ticketId: string,
    input: AssignTicketInput,
    requesterRole: UserRole
  ) {
    if (![UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(requesterRole)) {
      throw new ApiError(403, 'Only staff can assign tickets');
    }

    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    const assignee = await userRepository.findById(input.assignedTo);
    if (!assignee) {
      throw new ApiError(404, 'Assignee not found');
    }

    if (![UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(assignee.role)) {
      throw new ApiError(400, 'Tickets can only be assigned to staff members');
    }

    const updated = await ticketRepository.updateById(ticketId, {
      assignedTo: input.assignedTo,
      status: TicketStatus.IN_PROGRESS,
    });

    if (!updated) {
      throw new ApiError(404, 'Ticket not found');
    }

    const io = getSocketIO();
    if (io) {
      io.emit(SOCKET_EVENTS.TICKET_ASSIGNED, updated);
    }

    return updated;
  }
}

export const ticketService = new TicketService();
