import { Types } from 'mongoose';
import { Ticket } from '../models/Ticket.model';
import { User } from '../models/User.model';
import { Invitation } from '../models/Invitation.model';
import {
  ASSIGNABLE_STAFF_ROLES,
  InvitationStatus,
  TicketStatus,
} from '../constants';
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

function personSummary(u: any) {
  if (!u) return null;
  const id = u._id?.toString?.() ?? String(u._id ?? u.id ?? '');
  const name =
    u.name ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.email ||
    'Staff';
  return {
    id,
    name,
    email: u.email ?? undefined,
    role: u.role ?? undefined,
    departmentRole: u.departmentRole ?? undefined,
  };
}

function ticketSummary(t: any) {
  return {
    id: t._id?.toString?.() ?? String(t._id),
    ticketNumber: t.ticketNumber,
    title: t.title,
    status: t.status,
    priority: t.priority,
    overdue: !!t.overdue,
    assignedTo: personSummary(t.assignedTo),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt ?? null,
    resolutionDeadline: t.sla?.resolutionDeadline ?? null,
    ageHours: Math.round(hoursBetween(new Date(t.createdAt), new Date()) * 10) / 10,
    idleDays: Math.round(daysBetween(new Date(t.updatedAt), new Date()) * 10) / 10,
  };
}

function ticketsForUser(list: any[], userId: string) {
  return list.filter((t) => String(t.assignedTo?._id ?? t.assignedTo?.id ?? '') === userId);
}

export class WorkLimitsService {
  private async resolveTeam(viewerUserId?: string) {
    if (!viewerUserId || !Types.ObjectId.isValid(viewerUserId)) {
      return [] as Array<{
        id: string;
        name: string;
        email?: string;
        role?: string;
        departmentRole?: string;
        invitationId?: string;
        status: 'active' | 'pending';
        source: 'reporting_manager' | 'invited_by';
      }>;
    }

    const oid = new Types.ObjectId(viewerUserId);
    const [reportees, invites] = await Promise.all([
      User.find({
        reportingManager: oid,
        role: { $in: ASSIGNABLE_STAFF_ROLES },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .select('name email role departmentRole')
        .lean(),
      Invitation.find({
        $or: [{ invitedBy: oid }, { reportingManager: oid }],
        invitationStatus: { $in: [InvitationStatus.SENT, InvitationStatus.ACCEPTED] },
      })
        .select('firstName lastName email role departmentRole user invitationStatus')
        .lean(),
    ]);

    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        email?: string;
        role?: string;
        departmentRole?: string;
        invitationId?: string;
        status: 'active' | 'pending';
        source: 'reporting_manager' | 'invited_by';
      }
    >();

    for (const u of reportees) {
      const id = String(u._id);
      byId.set(id, {
        id,
        name: u.name || u.email || 'Staff',
        email: u.email,
        role: u.role,
        departmentRole: u.departmentRole,
        status: 'active',
        source: 'reporting_manager',
      });
    }

    for (const inv of invites) {
      const userId = inv.user ? String(inv.user) : undefined;
      const invitationId = String(inv._id);
      const name =
        [inv.firstName, inv.lastName].filter(Boolean).join(' ').trim() || inv.email || 'Invitee';
      const status = inv.invitationStatus === InvitationStatus.ACCEPTED && userId ? 'active' : 'pending';
      const key = userId || `inv:${invitationId}`;
      if (byId.has(key) && status === 'pending') continue;
      byId.set(key, {
        id: userId || invitationId,
        name,
        email: inv.email,
        role: inv.role,
        departmentRole: inv.departmentRole,
        invitationId,
        status,
        source: 'invited_by',
      });
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildTeamPerformance(
    team: Awaited<ReturnType<WorkLimitsService['resolveTeam']>>,
    buckets: {
      monthly: any[];
      quickSolve: any[];
      inProgress: any[];
      longPaused: any[];
      postTimePending: any[];
    }
  ) {
    return team.map((member) => {
      const monthly = member.status === 'active' ? ticketsForUser(buckets.monthly, member.id) : [];
      const quickSolve = member.status === 'active' ? ticketsForUser(buckets.quickSolve, member.id) : [];
      const inProgress = member.status === 'active' ? ticketsForUser(buckets.inProgress, member.id) : [];
      const longPaused = member.status === 'active' ? ticketsForUser(buckets.longPaused, member.id) : [];
      const postTimePending =
        member.status === 'active' ? ticketsForUser(buckets.postTimePending, member.id) : [];

      const recent = [...monthly, ...inProgress, ...longPaused, ...postTimePending, ...quickSolve]
        .filter((t, i, arr) => arr.findIndex((x) => String(x._id) === String(t._id)) === i)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6)
        .map(ticketSummary);

      return {
        ...member,
        counts: {
          monthly: monthly.length,
          quickSolve: quickSolve.length,
          inProgress: inProgress.length,
          longPaused: longPaused.length,
          postTimePending: postTimePending.length,
          total:
            new Set(
              [...monthly, ...quickSolve, ...inProgress, ...longPaused, ...postTimePending].map((t) =>
                String(t._id)
              )
            ).size,
        },
        recentTickets: recent,
      };
    });
  }

  async getOverview(from?: string, to?: string, viewerUserId?: string) {
    const settings = await orgSettingsService.getPublic();
    const { workLimits, monthlyAchievement, chartThresholds } = settings as any;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeFrom = parseDate(from) ?? monthStart;
    const rangeTo = parseDate(to) ?? now;

    const openStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING];

    const [monthlyTickets, openTickets, resolvedInRange, team] = await Promise.all([
      Ticket.find({ createdAt: { $gte: monthStart, $lte: now } })
        .populate('assignedTo', 'name email role departmentRole')
        .sort({ createdAt: -1 })
        .lean(),
      Ticket.find({ status: { $in: openStatuses } })
        .populate('assignedTo', 'name email role departmentRole')
        .sort({ updatedAt: 1 })
        .lean(),
      Ticket.find({
        status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        resolvedAt: { $gte: rangeFrom, $lte: rangeTo },
      })
        .populate('assignedTo', 'name email role departmentRole')
        .sort({ resolvedAt: -1 })
        .lean(),
      this.resolveTeam(viewerUserId),
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
    const teamPerformance = this.buildTeamPerformance(team, {
      monthly: monthlyTickets,
      quickSolve,
      inProgress,
      longPaused,
      postTimePending,
    });

    return {
      settings: workLimits,
      chartThresholds,
      monthlyAchievement,
      range: { from: rangeFrom, to: rangeTo },
      teamPerformance,
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

  async getTimeline(from?: string, to?: string, viewerUserId?: string) {
    const overview = await this.getOverview(from, to, viewerUserId);
    const rangeFrom = new Date(overview.range.from);
    const rangeTo = new Date(overview.range.to);

    const tickets = await Ticket.find({
      $or: [
        { createdAt: { $gte: rangeFrom, $lte: rangeTo } },
        { updatedAt: { $gte: rangeFrom, $lte: rangeTo } },
        { resolvedAt: { $gte: rangeFrom, $lte: rangeTo } },
      ],
    })
      .populate('assignedTo', 'name email role departmentRole')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    const events = tickets.flatMap((t) => {
      const base = ticketSummary(t);
      const list: Array<Record<string, unknown>> = [{ type: 'created', at: t.createdAt, ticket: base }];
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
      teamPerformance: overview.teamPerformance,
    };
  }

  async exportCsv(section: string | undefined, from?: string, to?: string, viewerUserId?: string): Promise<string> {
    const overview = await this.getOverview(from, to, viewerUserId);
    const key = (section || 'full') as BucketKey | 'full' | 'history' | 'team';

    const rows: string[][] = [
      [
        'section',
        'ticketNumber',
        'title',
        'status',
        'priority',
        'overdue',
        'assignee',
        'assigneeId',
        'createdAt',
        'updatedAt',
        'resolvedAt',
        'ageHours',
        'idleDays',
      ],
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
          t.assignedTo?.id ?? '',
          t.createdAt ? new Date(t.createdAt).toISOString() : '',
          t.updatedAt ? new Date(t.updatedAt).toISOString() : '',
          t.resolvedAt ? new Date(t.resolvedAt).toISOString() : '',
          String(t.ageHours ?? ''),
          String(t.idleDays ?? ''),
        ]);
      }
    };

    if (key === 'team') {
      rows.length = 0;
      rows.push(['name', 'id', 'email', 'role', 'status', 'monthly', 'quickSolve', 'inProgress', 'longPaused', 'postTimePending', 'total']);
      for (const m of overview.teamPerformance) {
        rows.push([
          m.name,
          m.id,
          m.email ?? '',
          m.role ?? '',
          m.status,
          String(m.counts.monthly),
          String(m.counts.quickSolve),
          String(m.counts.inProgress),
          String(m.counts.longPaused),
          String(m.counts.postTimePending),
          String(m.counts.total),
        ]);
      }
    } else if (key === 'full') {
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
