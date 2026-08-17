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

function roleLabel(role?: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'support_agent') return 'Support Agent';
  return role || 'Staff';
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function currentMonthKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function emptyPerformance() {
  return {
    month: {
      received: 0,
      inProgress: 0,
      resolved: 0,
      pending: 0,
      overdue: 0,
      completionPct: 0,
      progressPct: 0,
    },
    overall: {
      received: 0,
      inProgress: 0,
      resolved: 0,
      pending: 0,
      overdue: 0,
      progressPct: 0,
      overduePenaltyPct: 0,
      graceBonusPct: 0,
      graceMonths: [] as string[],
    },
  };
}

type TeamTrackNode = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  departmentRole?: string;
  status: 'active' | 'pending';
  source: 'invited_by' | 'reporting_manager' | 'self';
  invitedById?: string;
  invitedByName?: string;
  invitationRelation: string;
  depth: number;
  children: TeamTrackNode[];
};

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

  /**
   * Full invitation hierarchy under the viewer (admins + support agents only),
   * with current-month / overall ticket performance for each reachable member.
   */
  async getTeamTrack(viewerUserId?: string) {
    const tree = await this.resolveInviteHierarchy(viewerUserId);
    if (!tree.root) {
      return {
        root: null,
        members: [],
        paths: [] as string[],
        selectedDefaults: { memberId: null as string | null },
      };
    }

    const activeIds = tree.members
      .filter((m) => m.status === 'active' && Types.ObjectId.isValid(m.id))
      .map((m) => m.id);

    const performanceById = await this.buildMemberPerformance(activeIds);

    const members = tree.members.map((m) => {
      const { children: _children, ...rest } = m;
      const performance =
        m.status === 'active' && performanceById[m.id]
          ? performanceById[m.id]
          : emptyPerformance();
      return { ...rest, performance };
    });

    return {
      root: tree.root,
      members,
      paths: tree.paths,
      selectedDefaults: { memberId: members.find((m) => m.status === 'active')?.id ?? null },
    };
  }

  private async resolveInviteHierarchy(viewerUserId?: string) {
    if (!viewerUserId || !Types.ObjectId.isValid(viewerUserId)) {
      return { root: null as TeamTrackNode | null, members: [] as TeamTrackNode[], paths: [] as string[] };
    }

    const [viewer, invites, staff] = await Promise.all([
      User.findById(viewerUserId).select('name email role departmentRole').lean(),
      Invitation.find({
        invitationStatus: { $in: [InvitationStatus.SENT, InvitationStatus.ACCEPTED] },
        role: { $in: ASSIGNABLE_STAFF_ROLES },
      })
        .select(
          'firstName lastName email role departmentRole user invitationStatus invitedBy reportingManager'
        )
        .lean(),
      User.find({
        role: { $in: ASSIGNABLE_STAFF_ROLES },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .select('name email role departmentRole reportingManager')
        .lean(),
    ]);

    if (!viewer) {
      return { root: null as TeamTrackNode | null, members: [] as TeamTrackNode[], paths: [] as string[] };
    }

    const nameById = new Map<string, string>();
    for (const u of staff) {
      nameById.set(String(u._id), u.name || u.email || 'Staff');
    }
    nameById.set(String(viewer._id), viewer.name || viewer.email || 'You');

    // parentId → child stubs (may include pending invites without a user id yet)
    const childrenOf = new Map<string, Array<Omit<TeamTrackNode, 'children' | 'depth'>>>();

    const pushChild = (parentId: string, child: Omit<TeamTrackNode, 'children' | 'depth'>) => {
      const list = childrenOf.get(parentId) ?? [];
      if (list.some((c) => c.id === child.id)) return;
      list.push(child);
      childrenOf.set(parentId, list);
    };

    for (const inv of invites) {
      const parentId = String(inv.invitedBy);
      const userId = inv.user ? String(inv.user) : undefined;
      const invitationId = String(inv._id);
      const parentName = nameById.get(parentId) ?? 'Admin';
      const name =
        [inv.firstName, inv.lastName].filter(Boolean).join(' ').trim() ||
        inv.email ||
        'Invitee';
      const active = inv.invitationStatus === InvitationStatus.ACCEPTED && !!userId;
      const id = active ? userId! : `inv:${invitationId}`;
      if (active) nameById.set(id, name);
      pushChild(parentId, {
        id,
        name,
        email: inv.email,
        role: inv.role,
        departmentRole: inv.departmentRole,
        status: active ? 'active' : 'pending',
        source: 'invited_by',
        invitedById: parentId,
        invitedByName: parentName,
        invitationRelation: `Invited by ${parentName}`,
      });
    }

    for (const u of staff) {
      if (!u.reportingManager) continue;
      const parentId = String(u.reportingManager);
      const id = String(u._id);
      const parentName = nameById.get(parentId) ?? 'Manager';
      pushChild(parentId, {
        id,
        name: u.name || u.email || 'Staff',
        email: u.email,
        role: u.role,
        departmentRole: u.departmentRole,
        status: 'active',
        source: 'reporting_manager',
        invitedById: parentId,
        invitedByName: parentName,
        invitationRelation: `Reports to ${parentName}`,
      });
    }

    const rootId = String(viewer._id);
    const root: TeamTrackNode = {
      id: rootId,
      name: viewer.name || viewer.email || 'You',
      email: viewer.email,
      role: viewer.role,
      departmentRole: viewer.departmentRole,
      status: 'active',
      source: 'self',
      invitationRelation: 'You',
      depth: 0,
      children: [],
    };

    const members: TeamTrackNode[] = [];
    const paths: string[] = [];
    const visited = new Set<string>([rootId]);

    const build = (node: TeamTrackNode, trail: string[]) => {
      const kids = (childrenOf.get(node.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
      for (const stub of kids) {
        if (visited.has(stub.id)) continue;
        visited.add(stub.id);
        const child: TeamTrackNode = { ...stub, depth: node.depth + 1, children: [] };
        node.children.push(child);
        const nextTrail = [...trail, `${child.name} (${roleLabel(child.role)})`];
        paths.push(nextTrail.join(' → '));
        members.push(child);
        if (child.status === 'active') build(child, nextTrail);
      }
    };

    build(root, [`${root.name} (${roleLabel(root.role)})`]);

    // Flat list includes root for selection ("my own performance")
    const flat = [root, ...members];

    return { root, members: flat, paths };
  }

  private async buildMemberPerformance(userIds: string[]) {
    const result: Record<string, ReturnType<typeof emptyPerformance>> = {};
    if (userIds.length === 0) return result;

    const oids = userIds.map((id) => new Types.ObjectId(id));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const tickets = await Ticket.find({ assignedTo: { $in: oids } })
      .select('assignedTo status overdue createdAt resolvedAt')
      .lean();

    type Agg = {
      received: number;
      inProgress: number;
      resolved: number;
      pending: number;
      overdue: number;
      open: number;
    };

    const monthByUser = new Map<string, Agg>();
    const allByUser = new Map<string, Agg>();
    /** YYYY-MM → userId → { received, resolved } for grace bonuses */
    const hist = new Map<string, Map<string, { received: number; resolved: number }>>();

    const zero = (): Agg => ({
      received: 0,
      inProgress: 0,
      resolved: 0,
      pending: 0,
      overdue: 0,
      open: 0,
    });

    const bump = (map: Map<string, Agg>, uid: string, patch: Partial<Agg>) => {
      const cur = map.get(uid) ?? zero();
      for (const [k, v] of Object.entries(patch) as Array<[keyof Agg, number]>) {
        cur[k] += v;
      }
      map.set(uid, cur);
    };

    for (const t of tickets) {
      const uid = String(t.assignedTo);
      if (!userIds.includes(uid)) continue;

      const created = new Date(t.createdAt);
      const inMonth = created >= monthStart && created <= now;
      const resolvedAt = t.resolvedAt ? new Date(t.resolvedAt) : null;
      const resolvedInMonth = !!(resolvedAt && resolvedAt >= monthStart && resolvedAt <= now);
      const isResolved =
        t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED;
      const isInProgress = t.status === TicketStatus.IN_PROGRESS;
      const isPending = t.status === TicketStatus.PENDING || t.status === TicketStatus.OPEN;
      const isOpen = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING].includes(
        t.status as TicketStatus
      );

      // Overall
      bump(allByUser, uid, {
        received: 1,
        resolved: isResolved ? 1 : 0,
        inProgress: isInProgress ? 1 : 0,
        pending: isPending ? 1 : 0,
        overdue: t.overdue && isOpen ? 1 : 0,
        open: isOpen ? 1 : 0,
      });

      // Current month — received by create month; resolved by resolve month; live open statuses count now
      if (inMonth) bump(monthByUser, uid, { received: 1 });
      if (resolvedInMonth) bump(monthByUser, uid, { resolved: 1 });
      if (isInProgress) bump(monthByUser, uid, { inProgress: 1 });
      if (isPending) bump(monthByUser, uid, { pending: 1 });
      if (t.overdue && isOpen) bump(monthByUser, uid, { overdue: 1 });

      // Historical month buckets (for 80% grace)
      const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      if (!hist.has(monthKey)) hist.set(monthKey, new Map());
      const hm = hist.get(monthKey)!;
      const row = hm.get(uid) ?? { received: 0, resolved: 0 };
      row.received += 1;
      hm.set(uid, row);

      if (resolvedAt) {
        const rk = `${resolvedAt.getFullYear()}-${String(resolvedAt.getMonth() + 1).padStart(2, '0')}`;
        if (!hist.has(rk)) hist.set(rk, new Map());
        const rm = hist.get(rk)!;
        const rr = rm.get(uid) ?? { received: 0, resolved: 0 };
        rr.resolved += 1;
        rm.set(uid, rr);
      }
    }

    for (const uid of userIds) {
      const month = monthByUser.get(uid) ?? zero();
      const overall = allByUser.get(uid) ?? zero();

      const monthCompletion =
        month.received <= 0 ? 0 : (month.resolved / month.received) * 100;

      // Current month progress — positive weight on resolved / in-progress; no overdue penalty
      const monthDenom = Math.max(month.received, 1);
      const monthProgressRaw =
        ((month.resolved * 1.0 + month.inProgress * 0.35 + month.pending * 0.05) / monthDenom) *
        100;
      const monthProgress = Math.max(0, Math.min(100, round1(monthProgressRaw)));

      // Overall base from career resolve rate
      const overallDenom = Math.max(overall.received, 1);
      let overallScore = (overall.resolved / overallDenom) * 100;

      // Excessive pending drag (capped)
      overallScore -= Math.min(overall.pending * 0.5, 15);

      // Overdue penalty: −2% per overdue ticket
      const overduePenalty = overall.overdue * 2;
      overallScore -= overduePenalty;

      // Monthly grace: +0.5% for each month with ≥80% completion (incl. current)
      let graceBonus = 0;
      const graceMonths: string[] = [];
      for (const [key, byUser] of hist.entries()) {
        const row = byUser.get(uid);
        if (!row || row.received <= 0) continue;
        const pct = (row.resolved / row.received) * 100;
        if (pct >= 80) {
          graceBonus += 0.5;
          graceMonths.push(key);
        }
      }
      if (month.received > 0 && monthCompletion >= 80 && !graceMonths.includes(currentMonthKey(now))) {
        graceBonus += 0.5;
        graceMonths.push(currentMonthKey(now));
      }
      // Soft-cap career bonus so scores stay interpretable
      graceBonus = Math.min(graceBonus, 10);
      overallScore += graceBonus;

      overallScore = Math.max(0, Math.min(100, round1(overallScore)));

      result[uid] = {
        month: {
          received: month.received,
          inProgress: month.inProgress,
          resolved: month.resolved,
          pending: month.pending,
          overdue: month.overdue,
          completionPct: round1(monthCompletion),
          progressPct: monthProgress,
        },
        overall: {
          received: overall.received,
          inProgress: overall.inProgress,
          resolved: overall.resolved,
          pending: overall.pending,
          overdue: overall.overdue,
          progressPct: overallScore,
          overduePenaltyPct: overduePenalty,
          graceBonusPct: graceBonus,
          graceMonths,
        },
      };
    }

    return result;
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
