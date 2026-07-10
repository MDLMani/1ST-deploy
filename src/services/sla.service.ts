import { ticketRepository } from '../repositories/ticket.repository';
import { departmentRepository } from '../repositories/department.repository';
import { satisfactionRepository } from '../repositories/satisfaction.repository';
import { ApiError } from '../utils/ApiError';
import { TicketPriority, SOCKET_EVENTS } from '../constants';
import { getSocketIO } from '../sockets';
import { ITicket } from '../models/Ticket.model';

export class SLAService {
  async calculateDeadlines(ticket: ITicket): Promise<{ responseDeadline: Date; resolutionDeadline: Date }> {
    const now = new Date();
    let responseHours = 4;
    let resolutionHours = 24;

    if (ticket.department) {
      const dept = await departmentRepository.findById(ticket.department.toString());
      if (dept?.slaPolicy) {
        responseHours = dept.slaPolicy.responseTimeHours[ticket.priority] ?? responseHours;
        resolutionHours = dept.slaPolicy.resolutionTimeHours[ticket.priority] ?? resolutionHours;
      }
    } else {
      const defaults: Record<TicketPriority, { response: number; resolution: number }> = {
        [TicketPriority.CRITICAL]: { response: 1, resolution: 12 },
        [TicketPriority.HIGH]: { response: 4, resolution: 24 },
        [TicketPriority.MEDIUM]: { response: 8, resolution: 48 },
        [TicketPriority.LOW]: { response: 24, resolution: 72 },
      };
      const d = defaults[ticket.priority];
      responseHours = d.response;
      resolutionHours = d.resolution;
    }

    const responseDeadline = new Date(now.getTime() + responseHours * 60 * 60 * 1000);
    const resolutionDeadline = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);

    return { responseDeadline, resolutionDeadline };
  }

  async startSLA(ticketId: string): Promise<void> {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) return;
    const { responseDeadline, resolutionDeadline } = await this.calculateDeadlines(ticket);
    await ticketRepository.updateById(ticketId, {
      sla: {
        responseDeadline,
        resolutionDeadline,
        responseBreached: false,
        resolutionBreached: false,
      },
    });
  }

  async pauseSLA(_ticketId: string): Promise<void> {
    // SLA pauses are tracked via status change to PENDING
    // The cron job skips PENDING tickets
  }

  async resumeSLA(ticketId: string): Promise<void> {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) return;
    // Recalculate remaining time
    const { responseDeadline, resolutionDeadline } = await this.calculateDeadlines(ticket);
    await ticketRepository.updateById(ticketId, {
      sla: {
        responseDeadline,
        resolutionDeadline,
        responseBreached: ticket.sla?.responseBreached ?? false,
        resolutionBreached: ticket.sla?.resolutionBreached ?? false,
      },
    });
  }

  async breachSLA(ticketId: string, metric: 'response' | 'resolution'): Promise<void> {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) return;
    const update: Record<string, any> = {};
    if (metric === 'response') {
      update['sla.responseBreached'] = true;
    } else {
      update['sla.resolutionBreached'] = true;
    }
    const updated = await ticketRepository.updateById(ticketId, update);
    if (updated) {
      const io = getSocketIO();
      if (io) io.emit(SOCKET_EVENTS.SLA_BREACH, { ticket: updated, metric });
    }
  }

  async updateFirstResponseTime(ticketId: string): Promise<void> {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket || ticket.firstResponseAt) return;
    await ticketRepository.updateById(ticketId, { firstResponseAt: new Date() });
  }

  async checkBreaches(): Promise<void> {
    const breachedTickets = await ticketRepository.getSLABreachedTickets();
    const now = new Date();
    for (const ticket of breachedTickets) {
      if (ticket.sla?.responseDeadline && !ticket.sla.responseBreached && ticket.sla.responseDeadline <= now) {
        await this.breachSLA(ticket._id.toString(), 'response');
      }
      if (ticket.sla?.resolutionDeadline && !ticket.sla.resolutionBreached && ticket.sla.resolutionDeadline <= now) {
        await this.breachSLA(ticket._id.toString(), 'resolution');
      }
    }
  }

  async getTicketSLAStatus(ticketId: string) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new ApiError(404, 'Ticket not found');
    const now = new Date();
    const sla = ticket.sla;
    if (!sla?.responseDeadline) return { hasSLA: false };
    return {
      hasSLA: true,
      responseDeadline: sla.responseDeadline,
      resolutionDeadline: sla.resolutionDeadline,
      responseBreached: sla.responseBreached,
      resolutionBreached: sla.resolutionBreached,
      responseRemaining: sla.responseBreached ? 0 : Math.max(0, sla.responseDeadline.getTime() - now.getTime()),
      resolutionRemaining: sla.resolutionBreached ? 0 : Math.max(0, (sla.resolutionDeadline?.getTime() ?? 0) - now.getTime()),
    };
  }

  async getPolicies() {
    const departments = await departmentRepository.findAll();
    return departments.map((dept) => ({
      _id: dept._id,
      name: dept.name,
      slug: dept.slug,
      isActive: dept.isActive,
      slaPolicy: dept.slaPolicy,
      defaultPriority: dept.defaultPriority,
    }));
  }

  async getSLAStats() {
    const [breachedCount, activeCount, departmentBreakdown, csatStats] = await Promise.all([
      ticketRepository.countSLABreached(),
      ticketRepository.countActiveSLA(),
      ticketRepository.getDepartmentBreakdown(),
      satisfactionRepository.getCSATStats(),
    ]);
    return {
      breachedCount,
      activeCount,
      departmentBreakdown,
      csatAverage: csatStats.averageRating,
      csatTotalResponses: csatStats.totalResponses,
    };
  }
}

export const slaService = new SLAService();
