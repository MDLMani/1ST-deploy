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
import { ITicket } from '../models/Ticket.model';

type LocationHint = {
  district?: string;
  taluk?: string;
  city?: string;
};

function normalizeLocation(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function locationScore(agent: IUser, location: LocationHint): number {
  const district = normalizeLocation(location.district);
  const taluk = normalizeLocation(location.taluk);
  const city = normalizeLocation(location.city);
  if (!district && !taluk && !city) return 0;

  const agentDistrict = normalizeLocation(agent.district);
  const agentTaluk = normalizeLocation(agent.taluk);
  const agentCity = normalizeLocation(agent.city);

  let score = 0;
  if (district && agentDistrict === district) score += 1;
  if (taluk && agentTaluk === taluk) score += 2;
  if (city && agentCity === city) score += 4;

  // Prefer hierarchical consistency: city/taluk matches only count when district also matches when known.
  if (district && agentDistrict && agentDistrict !== district) return 0;
  return score;
}

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

    const location = await this.resolveTicketLocation(ticket);
    const agent = await this.pickDepartmentAgent(departmentId, location, {
      category: category ?? ticket.category,
      priority: priority ?? ticket.priority,
    });
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

  private async resolveTicketLocation(ticket: ITicket): Promise<LocationHint> {
    const fromTicket: LocationHint = {
      district: ticket.district,
      taluk: ticket.taluk,
      city: ticket.city,
    };
    if (fromTicket.district || fromTicket.taluk || fromTicket.city) {
      return fromTicket;
    }

    const ownerId =
      ticket.user && typeof ticket.user === 'object' && '_id' in ticket.user
        ? String((ticket.user as { _id: Types.ObjectId })._id)
        : String(ticket.user ?? '');
    if (!ownerId || !Types.ObjectId.isValid(ownerId)) return {};

    const owner = await userRepository.findById(ownerId);
    if (!owner) return {};
    return {
      district: owner.district,
      taluk: owner.taluk,
      city: owner.city,
    };
  }

  private async pickDepartmentAgent(
    departmentId: string,
    location: LocationHint,
    filters: { category?: string; priority?: string }
  ): Promise<IUser | null> {
    const agents = await userRepository.findActiveAgentsByDepartment(departmentId);
    if (agents.length === 0) return null;

    const ranked = this.rankByLocation(agents, location);
    const rules = await assignmentRuleRepository.findMatchingRules(
      departmentId,
      filters.category,
      filters.priority
    );
    const rule = rules.find((r) => r.strategy !== AssignmentStrategy.MANUAL);

    if (rule) {
      const viaRule = await this.pickByStrategy(rule, ranked);
      if (viaRule) return viaRule;
    }

    return this.executeLoadBalanced(ranked);
  }

  private rankByLocation(agents: IUser[], location: LocationHint): IUser[] {
    const scored = agents.map((agent) => ({
      agent,
      score: locationScore(agent, location),
    }));
    const best = Math.max(...scored.map((row) => row.score), 0);
    const pool = best > 0 ? scored.filter((row) => row.score === best) : scored;
    return pool.map((row) => row.agent);
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
