import { Ticket } from '../models/Ticket.model';
import { TicketStatus } from '../constants';
import { orgSettingsService } from './orgSettings.service';

type BucketKey = 'quickSolve' | 'inProgress' | 'longPaused' | 'postTimePending' | 'monthly';

function parseDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function daysBetween(a: Date, b: Date): number {
  return hoursBetween(a, b) / 24;
}

function ticketSummary(t: any) {
  return {
    id: t._id?.toString?.() ?? String(t._id),
    ticketNumber: t.ticketNumber,
    title: t.title,
    status: t.status,
    priority: t.priority,
    overdue: !!t.overdue,
    assignedTo: t.assignedTo
      ? {
          id: t.assignedTo._id?.toString?.() ?? String(t.assignedTo._id),
          name: t.assignedTo.name,
          role: t.assignedTo.role,
        }
      : null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt ?? null,
    resolutionDeadline: t.sla?.resolutionDeadline ?? null,
    ageHours: Math.round(hoursBetween(new Date(t.createdAt), new Date()) * 10) / 10,
    idleDays: Math.round(daysBetween(new Date(t.updatedAt), new Date()) * 10) / 10,
  };
}

export class WorkLimitsService {
  async getOverview(from?: string, to?: string) {
    const settings = await orgSettingsService.getPublic();
    const { workLimits, monthlyAchievement, chartThresholds } = settings as any;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeFrom = parseDate(from) ?? monthStart;
    const rangeTo = parseDate(to) ?? now;

    const openStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING];

    const [monthlyTickets, openTickets, resolvedInRange] = await Promise.all([
      Ticket.find({ createdAt: { $gte: monthStart, $lte: now } })
        .populate('assignedTo', 'name role')
        .sort({ createdAt: -1 })
        .lean(),
      Ticket.find({ status: { $in: openStatuses } })
        .populate('assignedTo', 'name role')
        .sort({ updatedAt: 1 })
        .lean(),
      Ticket.find({
        status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        resolvedAt: { $gte: rangeFrom, $lte: rangeTo },
      })
        .populate('assignedTo', 'name role')
        .sort({ resolvedAt: -1 })
        .lean(),
    ]);

    const quickSolve = resolvedInRange.filter((t) => {
      if (!t.resolvedAt) return false;
      return hoursBetween(new Date(t.createdAt), new Date(t.resolvedAt)) <= workLimits.quickSolveHours;
    });

    const inProgress = openTickets.filter((t) => t.status === TicketStatus.IN_PROGRESS);

    const longPaused = openTickets.filter((t) => {
      if (t.status === TicketStatus.IN_PROGRESS) return false;
      return daysBetween(new Date(t.updatedAt), now) >= workLimits.longPausedDays;
    });

    const postTimePending = openTickets.filter((t) => {
      if (t.overdue) return true;
      const deadline = t.sla?.resolutionDeadline;
      if (deadline && new Date(deadline) < now) return true;
      return hoursBetween(new Date(t.createdAt), now) >= workLimits.postTimePendingHours;
    });

    const mapList = (list: any[]) => list.map(ticketSummary);

    return {
      settings: workLimits,
      chartThresholds,
      monthlyAchievement,
      range: { from: rangeFrom, to: rangeTo },
      sections: {
        monthly: {
          limit: workLimits.monthlyTicketLimit,
          count: monthlyTickets.length,
          remaining: Math.max(0, workLimits.monthlyTicketLimit - monthlyTickets.length),
          overLimit: monthlyTickets.length > workLimits.monthlyTicketLimit,
          tickets: mapList(monthlyTickets),
        },
        quickSolve: {
          hours: workLimits.quickSolveHours,
          count: quickSolve.length,
          tickets: mapList(quickSolve),
        },
        inProgress: {
          count: inProgress.length,
          tickets: mapList(inProgress),
        },
        longPaused: {
          days: workLimits.longPausedDays,
          count: longPaused.length,
          tickets: mapList(longPaused),
        },
        postTimePending: {
          hours: workLimits.postTimePendingHours,
          count: postTimePending.length,
          tickets: mapList(postTimePending),
        },
      },
      history: mapList(
        [...monthlyTickets, ...resolvedInRange]
          .filter((t, i, arr) => arr.findIndex((x) => String(x._id) === String(t._id)) === i)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 100)
      ),
    };
  }

  async getTimeline(from?: string, to?: string) {
    const overview = await this.getOverview(from, to);
    const rangeFrom = new Date(overview.range.from);
    const rangeTo = new Date(overview.range.to);

    const tickets = await Ticket.find({
      $or: [
        { createdAt: { $gte: rangeFrom, $lte: rangeTo } },
        { updatedAt: { $gte: rangeFrom, $lte: rangeTo } },
        { resolvedAt: { $gte: rangeFrom, $lte: rangeTo } },
      ],
    })
      .populate('assignedTo', 'name role')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    const events = tickets.flatMap((t) => {
      const base = ticketSummary(t);
      const list: Array<Record<string, unknown>> = [
        { type: 'created', at: t.createdAt, ticket: base },
      ];
      if (t.firstResponseAt) {
        list.push({ type: 'first_response', at: t.firstResponseAt, ticket: base });
      }
      if (t.resolvedAt) {
        list.push({ type: 'resolved', at: t.resolvedAt, ticket: base });
      }
      list.push({ type: 'updated', at: t.updatedAt, ticket: base });
      return list;
    });

    events.sort((a, b) => new Date(b.at as Date).getTime() - new Date(a.at as Date).getTime());

    return {
      range: overview.range,
      events,
      sections: overview.sections,
    };
  }

  async exportCsv(section: string | undefined, from?: string, to?: string): Promise<string> {
    const overview = await this.getOverview(from, to);
    const key = (section || 'full') as BucketKey | 'full' | 'history';

    const rows: string[][] = [
      ['section', 'ticketNumber', 'title', 'status', 'priority', 'overdue', 'assignee', 'createdAt', 'updatedAt', 'resolvedAt', 'ageHours', 'idleDays'],
    ];

    const pushTickets = (sectionName: string, tickets: any[]) => {
      for (const t of tickets) {
        rows.push([
          sectionName,
          t.ticketNumber ?? '',
          (t.title ?? '').replace(/"/g, '""'),
          t.status ?? '',
          t.priority ?? '',
          t.overdue ? 'yes' : 'no',
          t.assignedTo?.name ?? '',
          t.createdAt ? new Date(t.createdAt).toISOString() : '',
          t.updatedAt ? new Date(t.updatedAt).toISOString() : '',
          t.resolvedAt ? new Date(t.resolvedAt).toISOString() : '',
          String(t.ageHours ?? ''),
          String(t.idleDays ?? ''),
        ]);
      }
    };

    if (key === 'full') {
      pushTickets('monthly', overview.sections.monthly.tickets);
      pushTickets('quickSolve', overview.sections.quickSolve.tickets);
      pushTickets('inProgress', overview.sections.inProgress.tickets);
      pushTickets('longPaused', overview.sections.longPaused.tickets);
      pushTickets('postTimePending', overview.sections.postTimePending.tickets);
    } else if (key === 'history') {
      pushTickets('history', overview.history);
    } else if (key in overview.sections) {
      pushTickets(key, (overview.sections as any)[key].tickets);
    } else {
      pushTickets('monthly', overview.sections.monthly.tickets);
    }

    return rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}

export const workLimitsService = new WorkLimitsService();
