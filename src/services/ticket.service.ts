import { departmentRepository } from '../repositories/department.repository';
import { ticketRepository, TicketQueryOptions } from '../repositories/ticket.repository';
import { userRepository } from '../repositories/user.repository';
import { tagRepository } from '../repositories/tag.repository';
import { ApiError } from '../utils/ApiError';
import { TicketPriority, TicketStatus, UserRole, SOCKET_EVENTS } from '../constants';
import { IAttachment } from '../interfaces';
import { CreateTicketInput, UpdateStatusInput, AssignTicketInput } from '../validators';
import { getSocketIO } from '../sockets';
import { getTicketOwnerId } from '../utils/ticket.helpers';
import { notificationService } from './notification.service';
import { customFieldService } from './customField.service';
import { slaService } from './sla.service';
import { knowledgeBaseService } from './knowledgeBase.service';
import { assignmentService } from './assignment.service';
import { Types } from 'mongoose';

export class TicketService {
  private async generateTicketNumber(): Promise<string> {
    const count = await ticketRepository.countDocuments();
    const year = new Date().getFullYear();
    return `TVK-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async createTicket(userId: string, input: CreateTicketInput, attachments: IAttachment[] = []) {
    const ticketNumber = await this.generateTicketNumber();

    let customFields = input.customFields;
    if (typeof customFields === 'string') {
      try {
        customFields = JSON.parse(customFields);
      } catch {
        customFields = undefined;
      }
    }

    let tagIds = input.tags;
    if (tagIds && !Array.isArray(tagIds)) {
      tagIds = [tagIds as unknown as string];
    }

    let departmentId: string | undefined = input.department;
    if (departmentId && !Types.ObjectId.isValid(departmentId)) {
      const deptBySlug = await departmentRepository.findBySlug(departmentId);
      departmentId = deptBySlug?._id.toString();
    }
    if (!departmentId) {
      throw new ApiError(400, 'Department is required');
    }
    const department = await departmentRepository.findById(departmentId);
    if (!department || !department.isActive) {
      throw new ApiError(400, 'Department not found');
    }

    // Validate custom fields if provided
    if (customFields && Object.keys(customFields).length > 0) {
      await customFieldService.validateCustomFields(departmentId, customFields);
    }

    const creator = await userRepository.findById(userId);
    const district = input.district?.trim() || creator?.district;
    const taluk = input.taluk?.trim() || creator?.taluk;
    const city = input.city?.trim() || creator?.city;

    const ticket = await ticketRepository.create({
      ticketNumber,
      user: new Types.ObjectId(userId),
      title: input.title,
      description: input.description,
      category: input.category,
      customCategory: input.customCategory?.trim() || undefined,
      priority: input.priority ?? TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      attachments,
      overdue: false,
      reminderCount: 0,
      department: new Types.ObjectId(departmentId),
      district,
      taluk,
      city,
      tags: tagIds ? tagIds.map((id) => new Types.ObjectId(id)) : [],
      customFields: customFields ? new Map(Object.entries(customFields)) : new Map(),
      isInternal: input.isInternal ?? false,
    });

    // Start SLA
    await slaService.startSLA(ticket._id.toString());

    // Auto-assign by department + location (best available staff match)
    try {
      await assignmentService.autoAssignTicket(
        ticket._id.toString(),
        departmentId,
        input.category,
        ticket.priority
      );
    } catch {
      // Ignore auto-assignment errors — ticket remains unassigned
    }

    // Increment tag usage
    if (tagIds && tagIds.length > 0) {
      await tagRepository.incrementUsage(tagIds);
    }

    const populated = await ticketRepository.findById(ticket._id.toString());

    // Suggest knowledge base articles
    let suggestedArticles: any[] = [];
    try {
      const tags = populated?.tags?.map((t: any) => t.name || '') ?? [];
      suggestedArticles = await knowledgeBaseService.getSuggestedArticles(input.category, tags, 3);
    } catch {
      // Ignore KB errors
    }

    const io = getSocketIO();
    if (io && populated) {
      io.emit(SOCKET_EVENTS.TICKET_CREATED, populated);
    }

    await notificationService.notifyUser(
      userId,
      'TICKET_CREATED',
      {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
      },
      ticket._id.toString()
    );

    return { ...populated?.toObject(), suggestedArticles };
  }

  async getUserTickets(userId: string, options: TicketQueryOptions) {
    return ticketRepository.findByUserId(userId, options);
  }

  async getAllTickets(options: TicketQueryOptions) {
    return ticketRepository.findAll(options);
  }

  async getDashboardStats() {
    const stats = await ticketRepository.getDashboardStats();
    const staff = await userRepository.findAgentsAndAdmins();
    return {
      ...stats,
      activeAgents: staff.length,
    };
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
      updateData.resolvedAt = new Date();
    }

    if (input.status === TicketStatus.PENDING) {
      await slaService.pauseSLA(ticketId);
    } else if (ticket.status === TicketStatus.PENDING) {
      await slaService.resumeSLA(ticketId);
    }

    const updated = await ticketRepository.updateById(ticketId, updateData);
    if (!updated) {
      throw new ApiError(404, 'Ticket not found');
    }

    const io = getSocketIO();
    if (io) {
      io.emit(SOCKET_EVENTS.TICKET_UPDATED, updated);
    }

    const ownerId = getTicketOwnerId(updated);
    const templateId =
      input.status === TicketStatus.RESOLVED || input.status === TicketStatus.CLOSED
        ? 'TICKET_RESOLVED'
        : 'TICKET_UPDATED';

    await notificationService.notifyUser(
      ownerId,
      templateId,
      {
        ticketNumber: updated.ticketNumber,
        title: updated.title,
        status: input.status,
      },
      updated._id.toString()
    );

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

    // Reset SLA response timer on re-assignment
    await slaService.startSLA(ticketId);

    if (!updated) {
      throw new ApiError(404, 'Ticket not found');
    }

    const io = getSocketIO();
    if (io) {
      io.emit(SOCKET_EVENTS.TICKET_ASSIGNED, updated);
    }

    const ownerId = getTicketOwnerId(updated);
    await notificationService.notifyUser(
      ownerId,
      'TICKET_ASSIGNED',
      {
        ticketNumber: updated.ticketNumber,
        title: updated.title,
      },
      updated._id.toString()
    );

    return updated;
  }
}

export const ticketService = new TicketService();
