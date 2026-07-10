import { escalationRuleRepository } from '../repositories/escalationRule.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { tagRepository } from '../repositories/tag.repository';
import { ApiError } from '../utils/ApiError';
import { SOCKET_EVENTS } from '../constants';
import { EscalationRuleInput, UpdateEscalationRuleInput } from '../validators';
import { getSocketIO } from '../sockets';
import { notificationService } from './notification.service';
import { ITicket } from '../models/Ticket.model';
import { Types } from 'mongoose';

export class EscalationService {
  async createRule(input: EscalationRuleInput) {
    return escalationRuleRepository.create({
      ...input,
      conditions: {
        ...input.conditions,
        department: input.conditions.department ? new Types.ObjectId(input.conditions.department) : undefined,
      },
      actions: {
        ...input.actions,
        assignTo: input.actions.assignTo ? new Types.ObjectId(input.actions.assignTo) : undefined,
        notifyUsers: input.actions.notifyUsers?.map((id) => new Types.ObjectId(id)),
      },
    });
  }

  async getRules() {
    return escalationRuleRepository.findAll();
  }

  async updateRule(id: string, input: UpdateEscalationRuleInput) {
    const rule = await escalationRuleRepository.findById(id);
    if (!rule) throw new ApiError(404, 'Escalation rule not found');
    const updated = await escalationRuleRepository.updateById(id, input);
    if (!updated) throw new ApiError(404, 'Escalation rule not found');
    return updated;
  }

  async deleteRule(id: string) {
    const rule = await escalationRuleRepository.findById(id);
    if (!rule) throw new ApiError(404, 'Escalation rule not found');
    const deleted = await escalationRuleRepository.deleteById(id);
    if (!deleted) throw new ApiError(404, 'Escalation rule not found');
    return { message: 'Escalation rule deleted successfully' };
  }

  async evaluateRules(ticket: ITicket): Promise<void> {
    const rules = await escalationRuleRepository.findActiveRules();
    for (const rule of rules) {
      if (this.matchesConditions(ticket, rule)) {
        await this.executeRule(ticket, rule);
      }
    }
  }

  private matchesConditions(ticket: ITicket, rule: any): boolean {
    const conds = rule.conditions;
    if (conds.department && ticket.department?.toString() !== conds.department.toString()) return false;
    if (conds.priority && conds.priority.length > 0 && !conds.priority.includes(ticket.priority)) return false;
    if (conds.status && conds.status.length > 0 && !conds.status.includes(ticket.status)) return false;
    if (conds.timeElapsedMinutes) {
      const elapsed = (Date.now() - ticket.createdAt.getTime()) / (1000 * 60);
      if (elapsed < conds.timeElapsedMinutes) return false;
    }
    return true;
  }

  private async executeRule(ticket: ITicket, rule: any): Promise<void> {
    const actions = rule.actions;
    const update: Record<string, any> = {};

    if (actions.assignTo) {
      update.assignedTo = actions.assignTo;
      update.status = 'IN_PROGRESS';
    }
    if (actions.changePriority) {
      update.priority = actions.changePriority;
    }
    if (actions.addTag) {
      let tag = await tagRepository.findByName(actions.addTag);
      if (!tag) {
        tag = await tagRepository.create({ name: actions.addTag.toLowerCase(), createdBy: ticket.user, usageCount: 0 });
      }
      if (!ticket.tags?.some((t) => t.toString() === tag!._id.toString())) {
        update.$addToSet = { tags: tag._id };
      }
    }

    update.escalationLevel = (ticket.escalationLevel || 0) + 1;

    await ticketRepository.updateById(ticket._id.toString(), update);

    const io = getSocketIO();
    if (io) io.emit(SOCKET_EVENTS.TICKET_ESCALATED, { ticketId: ticket._id, rule: rule.name });

    if (actions.notifyUsers?.length) {
      for (const userId of actions.notifyUsers) {
        await notificationService.notifyUser(userId.toString(), 'TICKET_UPDATED', { ticketNumber: ticket.ticketNumber, title: `Escalated: ${rule.name}` }, ticket._id.toString());
      }
    }
  }

  async processEscalations(): Promise<void> {
    const { Ticket } = require('../models/Ticket.model');
    const unresolvedStatuses = ['OPEN', 'IN_PROGRESS', 'PENDING'];
    const tickets = await Ticket.find({ status: { $in: unresolvedStatuses } }).exec();
    for (const ticket of tickets) {
      await this.evaluateRules(ticket);
    }
  }
}

export const escalationService = new EscalationService();
