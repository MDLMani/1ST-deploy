import { Types } from 'mongoose';
import { assignmentRuleRepository } from '../repositories/assignmentRule.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/ApiError';
import {
  AssignmentStrategy,
  TicketStatus,
  SOCKET_EVENTS,
} from '../constants';
import { AssignmentRuleInput, UpdateAssignmentRuleInput } from '../validators';
import { getSocketIO } from '../sockets';
import { IUser } from '../models/User.model';
import { IAssignmentRule } from '../models/AssignmentRule.model';

export class AssignmentService {
  async createRule(creatorId: string, input: AssignmentRuleInput) {
    return assignmentRuleRepository.create({
      ...input,
      department: new Types.ObjectId(input.department),
      createdBy: new Types.ObjectId(creatorId),
    });
  }

  async getRules() {
    return assignmentRuleRepository.findAll();
  }

  async updateRule(ruleId: string, input: UpdateAssignmentRuleInput) {
    const rule = await assignmentRuleRepository.findById(ruleId);
    if (!rule) throw new ApiError(404, 'Assignment rule not found');
    const update: Record<string, unknown> = { ...input };
    if (input.department) update.department = new Types.ObjectId(input.department);
    const updated = await assignmentRuleRepository.updateById(ruleId, update);
    if (!updated) throw new ApiError(404, 'Assignment rule not found');
    return updated;
  }

  async deleteRule(ruleId: string) {
    const rule = await assignmentRuleRepository.findById(ruleId);
    if (!rule) throw new ApiError(404, 'Assignment rule not found');
    const deleted = await assignmentRuleRepository.deleteById(ruleId);
    if (!deleted) throw new ApiError(404, 'Assignment rule not found');
    return { message: 'Assignment rule deleted successfully' };
  }

  async autoAssignTicket(
    ticketId: string,
    departmentId?: string,
    category?: string,
    priority?: string
  ): Promise<IUser | null> {
    if (!departmentId) return null;

    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket || ticket.assignedTo) return null;

    const rules = await assignmentRuleRepository.findMatchingRules(
      departmentId,
      category ?? ticket.category,
      priority ?? ticket.priority
    );
    const rule = rules.find((r) => r.strategy !== AssignmentStrategy.MANUAL);
    if (!rule) return null;

    const agent = await this.executeStrategy(rule);
    if (!agent) return null;

    const updated = await ticketRepository.updateById(ticketId, {
      assignedTo: agent._id,
      status: TicketStatus.IN_PROGRESS,
    });

    if (updated) {
      const io = getSocketIO();
      if (io) io.emit(SOCKET_EVENTS.TICKET_ASSIGNED, updated);
    }

    return agent;
  }

  private async executeStrategy(rule: IAssignmentRule): Promise<IUser | null> {
    const departmentId = rule.department.toString();
    const agents = await userRepository.findActiveAgentsByDepartment(departmentId);
    if (agents.length === 0) {
      const fallback = await userRepository.findAgentsAndAdmins();
      if (fallback.length === 0) return null;
      return this.pickByStrategy(rule, fallback);
    }
    return this.pickByStrategy(rule, agents);
  }

  private async pickByStrategy(rule: IAssignmentRule, agents: IUser[]): Promise<IUser | null> {
    let pool = agents;
    if (rule.skillRequired) {
      pool = agents.filter((a) => a.skills?.includes(rule.skillRequired!));
      if (pool.length === 0) pool = agents;
    }

    switch (rule.strategy) {
      case AssignmentStrategy.ROUND_ROBIN:
        return this.executeRoundRobin(rule, pool);
      case AssignmentStrategy.LOAD_BALANCED:
        return this.executeLoadBalanced(pool);
      case AssignmentStrategy.SKILL_BASED:
        return this.executeLoadBalanced(pool);
      default:
        return pool[0] ?? null;
    }
  }

  private async executeRoundRobin(rule: IAssignmentRule, agents: IUser[]): Promise<IUser | null> {
    if (agents.length === 0) return null;
    const index = rule.lastAssignedIndex % agents.length;
    const agent = agents[index];
    await assignmentRuleRepository.incrementRoundRobin(rule._id.toString(), index + 1);
    return agent;
  }

  private async executeLoadBalanced(agents: IUser[]): Promise<IUser | null> {
    if (agents.length === 0) return null;
    let best = agents[0];
    let lowest = Infinity;
    for (const agent of agents) {
      const count = await ticketRepository.countOpenTicketsForAgent(agent._id.toString());
      const maxLoad = agent.maxTicketLoad ?? 20;
      if (count < maxLoad && count < lowest) {
        lowest = count;
        best = agent;
      }
    }
    return best;
  }
}

export const assignmentService = new AssignmentService();
