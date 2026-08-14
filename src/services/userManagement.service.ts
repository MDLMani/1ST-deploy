import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import {
  AccessLevel,
  AccountStatus,
  ApprovalStatus,
  APPROVAL_OVERDUE_HOURS,
  ASSIGNABLE_STAFF_ROLES,
  AuditAction,
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_PARTY,
  DEPARTMENT_ROLE_LABELS,
  DepartmentRole,
  departmentRoleToUserRole,
  INVITATION_EXPIRY_DAYS,
  InvitationStatus,
  PARTY_ROLES,
  TAMIL_NADU_DISTRICTS,
  UserRole,
} from '../constants';
import { IInvitation } from '../models/Invitation.model';
import { IUser } from '../models/User.model';
import { invitationRepository } from '../repositories/invitation.repository';
import { auditRepository } from '../repositories/audit.repository';
import { userRepository } from '../repositories/user.repository';
import { departmentRepository } from '../repositories/department.repository';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { sendStaffInvitationEmail } from './email.service';
import {
  AcceptInvitationInput,
  InviteUserInput,
  KeepPendingInput,
  RejectInvitationInput,
  UserManagementListQuery,
} from '../validators';
import { IJwtPayload } from '../interfaces';
import { locationService } from './location.service';

const SALT_ROUNDS = 12;

type Actor = IJwtPayload;

type PersonDto = { id: string; name: string; email: string; role?: string };

export type ManagedUserDto = {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  department?: { id: string; name: string };
  company?: string;
  district?: string;
  taluk?: string;
  city?: string;
  partyRole?: string;
  party?: string;
  departmentRole?: string;
  role: UserRole;
  accessLevel: AccessLevel;
  reportingManager?: PersonDto;
  additionalInformation?: string;
  invitationStatus: InvitationStatus;
  approvalStatus: ApprovalStatus;
  accountStatus: AccountStatus;
  isOverdue: boolean;
  pendingAction?: string;
  nextAction?: string;
  pendingSince?: string;
  invitedAt: string;
  acceptedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiresAt: string;
  invitedBy?: PersonDto;
  approvedBy?: PersonDto;
  rejectionReason?: string;
  resolutionNote?: string;
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function resolveOrganizationId(user?: Pick<IUser, 'organizationId'> | null): string {
  return user?.organizationId || DEFAULT_ORGANIZATION_ID;
}

function roleLabel(role: UserRole): string {
  if (role === UserRole.ADMIN) return 'Admin';
  if (role === UserRole.SUPPORT_AGENT) return 'Support Agent';
  return 'User';
}

function asPerson(value: unknown): PersonDto | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const doc = value as { _id?: unknown; id?: unknown; name?: string; email?: string; role?: string };
  const id = String(doc._id ?? doc.id ?? '');
  if (!id || !doc.email) return undefined;
  return { id, name: doc.name || doc.email, email: doc.email, role: doc.role };
}

function asDepartment(value: unknown): { id: string; name: string } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const doc = value as { _id?: unknown; id?: unknown; name?: string };
  const id = String(doc._id ?? doc.id ?? '');
  if (!id || !doc.name) return undefined;
  return { id, name: doc.name };
}

function optionalObjectId(value?: string): Types.ObjectId | undefined {
  if (!value) return undefined;
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, 'Invalid id');
  return new Types.ObjectId(value);
}

function defaultAccessLevel(role: UserRole, requested?: AccessLevel): AccessLevel {
  if (requested) return requested;
  return role === UserRole.ADMIN ? AccessLevel.FULL : AccessLevel.STANDARD;
}

function assertAdmin(actor: Actor): void {
  if (actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'Only admins can manage staff invitations and approvals');
  }
}

function assertCanAssignRole(actor: Actor, role: UserRole): void {
  assertAdmin(actor);
  if (!ASSIGNABLE_STAFF_ROLES.includes(role)) {
    throw new ApiError(400, 'Role is not assignable for staff invitations');
  }
}

function isApprovalOpen(status: ApprovalStatus): boolean {
  return status === ApprovalStatus.PENDING || status === ApprovalStatus.KEEP_PENDING;
}

function computeOverdue(inv: IInvitation): boolean {
  if (inv.invitationStatus === InvitationStatus.EXPIRED && isApprovalOpen(inv.approvalStatus)) {
    return true;
  }
  if (!isApprovalOpen(inv.approvalStatus)) return false;
  const since = inv.acceptedAt || inv.invitedAt;
  return Date.now() - new Date(since).getTime() > APPROVAL_OVERDUE_HOURS * 60 * 60 * 1000;
}

function pendingMeta(inv: IInvitation): { pendingAction?: string; nextAction?: string; pendingSince?: Date } {
  if (inv.invitationStatus === InvitationStatus.EXPIRED && isApprovalOpen(inv.approvalStatus)) {
    return {
      pendingAction: 'Invitation expired without acceptance',
      nextAction: 'Resend invitation or reject the request',
      pendingSince: inv.invitedAt,
    };
  }
  if (inv.invitationStatus === InvitationStatus.SENT && isApprovalOpen(inv.approvalStatus)) {
    return {
      pendingAction: 'Waiting for invitee to accept',
      nextAction: 'Follow up or wait for acceptance, then review for approval',
      pendingSince: inv.invitedAt,
    };
  }
  if (inv.invitationStatus === InvitationStatus.ACCEPTED && isApprovalOpen(inv.approvalStatus)) {
    return {
      pendingAction:
        inv.approvalStatus === ApprovalStatus.KEEP_PENDING
          ? 'Kept pending — resolution required'
          : 'Accepted invitation awaiting approval',
      nextAction: 'Review submitted information and approve or reject',
      pendingSince: inv.acceptedAt || inv.invitedAt,
    };
  }
  return {};
}

function accountStatusOf(inv: IInvitation): AccountStatus {
  const user = inv.user as unknown as IUser | undefined;
  if (!user || typeof user !== 'object' || !('isActive' in user || user.email)) {
    return AccountStatus.NONE;
  }
  return user.isActive === false ? AccountStatus.INACTIVE : AccountStatus.ACTIVE;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] || name, lastName: parts.slice(1).join(' ') };
}

function staffToManagedUser(user: IUser): ManagedUserDto {
  const names = {
    firstName: user.firstName || splitName(user.name).firstName,
    lastName: user.lastName || splitName(user.name).lastName,
  };
  return {
    id: String(user._id),
    userId: String(user._id),
    firstName: names.firstName,
    lastName: names.lastName,
    name: user.name,
    email: user.email,
    phone: user.phone,
    jobTitle: user.jobTitle,
    department: asDepartment(user.department),
    company: user.company,
    district: user.district,
    taluk: user.taluk,
    city: user.city,
    partyRole: user.partyRole,
    party: user.party,
    departmentRole: user.departmentRole,
    role: user.role,
    accessLevel: user.accessLevel || (user.role === UserRole.ADMIN ? AccessLevel.FULL : AccessLevel.STANDARD),
    reportingManager: asPerson(user.reportingManager),
    additionalInformation: user.additionalInformation,
    invitationStatus: InvitationStatus.ACCEPTED,
    approvalStatus: ApprovalStatus.APPROVED,
    accountStatus: user.isActive === false ? AccountStatus.INACTIVE : AccountStatus.ACTIVE,
    isOverdue: false,
    invitedAt: user.createdAt.toISOString(),
    expiresAt: user.createdAt.toISOString(),
    acceptedAt: user.createdAt.toISOString(),
  };
}

function toManagedUser(inv: IInvitation): ManagedUserDto {
  const overdue = computeOverdue(inv);
  const pending = pendingMeta(inv);
  const user = asPerson(inv.user);
  return {
    id: String(inv._id),
    userId: user?.id,
    firstName: inv.firstName,
    lastName: inv.lastName,
    name: `${inv.firstName} ${inv.lastName}`.trim(),
    email: inv.email,
    phone: inv.phone,
    jobTitle: inv.jobTitle,
    department: asDepartment(inv.department),
    company: inv.company,
    district: inv.district,
    taluk: inv.taluk,
    city: inv.city,
    partyRole: inv.partyRole,
    party: inv.party,
    departmentRole: inv.departmentRole,
    role: inv.role,
    accessLevel: inv.accessLevel,
    reportingManager: asPerson(inv.reportingManager),
    additionalInformation: inv.additionalInformation,
    invitationStatus: inv.invitationStatus,
    approvalStatus: inv.approvalStatus,
    accountStatus: accountStatusOf(inv),
    isOverdue: overdue,
    pendingAction: pending.pendingAction,
    nextAction: pending.nextAction,
    pendingSince: pending.pendingSince?.toISOString(),
    invitedAt: inv.invitedAt.toISOString(),
    acceptedAt: inv.acceptedAt?.toISOString(),
    approvedAt: inv.approvedAt?.toISOString(),
    rejectedAt: inv.rejectedAt?.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
    invitedBy: asPerson(inv.invitedBy),
    approvedBy: asPerson(inv.approvedBy),
    rejectionReason: inv.rejectionReason,
    resolutionNote: inv.resolutionNote,
  };
}

function toAuditDto(event: {
  _id: unknown;
  actor?: unknown;
  actorEmail: string;
  actorRole: string;
  targetType: string;
  targetId: unknown;
  targetEmail: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}) {
  return {
    id: String(event._id),
    actor: asPerson(event.actor) ?? {
      id: '',
      name: event.actorEmail,
      email: event.actorEmail,
      role: event.actorRole,
    },
    targetType: event.targetType,
    targetId: String(event.targetId),
    targetEmail: event.targetEmail,
    action: event.action,
    previousStatus: event.previousStatus,
    newStatus: event.newStatus,
    metadata: event.metadata,
    timestamp: event.createdAt.toISOString(),
  };
}

function matchesFilter(row: ManagedUserDto, filter?: UserManagementListQuery['filter']): boolean {
  switch (filter) {
    case 'pending_approval':
      return isApprovalOpen(row.approvalStatus);
    case 'overdue':
      return row.isOverdue;
    case 'approved':
      return row.approvalStatus === ApprovalStatus.APPROVED;
    case 'rejected':
      return row.approvalStatus === ApprovalStatus.REJECTED;
    case 'active':
      return row.accountStatus === AccountStatus.ACTIVE;
    case 'inactive':
      return row.accountStatus === AccountStatus.INACTIVE;
    default:
      return true;
  }
}

export class UserManagementService {
  private async loadActor(actor: Actor): Promise<IUser> {
    const user = await userRepository.findById(actor.userId);
    if (!user) throw new ApiError(401, 'Authentication required');
    if (user.role !== UserRole.ADMIN) {
      throw new ApiError(403, 'Only admins can manage staff invitations and approvals');
    }
    return user;
  }

  private async recordAudit(params: {
    organizationId: string;
    actor?: Actor;
    targetType: 'invitation' | 'user';
    targetId: string;
    targetEmail: string;
    action: AuditAction;
    previousStatus?: string;
    newStatus?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await auditRepository.create({
      organizationId: params.organizationId,
      actor: params.actor ? new Types.ObjectId(params.actor.userId) : undefined,
      actorEmail: params.actor?.email ?? 'system',
      actorRole: params.actor?.role ?? 'system',
      targetType: params.targetType,
      targetId: new Types.ObjectId(params.targetId),
      targetEmail: params.targetEmail,
      action: params.action,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      metadata: params.metadata,
    });
  }

  private async sendInviteEmail(inv: IInvitation, token: string, inviterName: string): Promise<void> {
    const acceptBase = env.INVITE_ACCEPT_URL?.trim();
    const acceptUrl = acceptBase
      ? `${acceptBase}${acceptBase.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : undefined;

    await sendStaffInvitationEmail(inv.email, {
      firstName: inv.firstName,
      inviterName,
      roleLabel: roleLabel(inv.role),
      organization: inv.company || 'TVK Support',
      token,
      acceptUrl,
      expiryDays: INVITATION_EXPIRY_DAYS,
    });
  }

  async getPermittedRoles(actor: Actor) {
    const admin = await this.loadActor(actor);
    const seededDistricts = await locationService
      .listDistricts()
      .then((rows) => rows.map((row) => row.name))
      .catch(() => [] as string[]);
    return {
      organizationId: resolveOrganizationId(admin),
      roles: ASSIGNABLE_STAFF_ROLES.map((role) => ({
        value: role,
        label: roleLabel(role),
        requiresAdminConfirmation: role === UserRole.ADMIN,
      })),
      accessLevels: Object.values(AccessLevel).map((value) => ({
        value,
        label: value === AccessLevel.FULL ? 'Full' : value === AccessLevel.LIMITED ? 'Limited' : 'Standard',
      })),
      districts: seededDistricts.length > 0 ? seededDistricts : [...TAMIL_NADU_DISTRICTS],
      partyRoles: PARTY_ROLES.map((value) => ({
        value,
        label: value
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
      })),
      departmentRoles: Object.values(DepartmentRole).map((value) => ({
        value,
        label: DEPARTMENT_ROLE_LABELS[value],
        mapsToRole: departmentRoleToUserRole(value),
        requiresAdminConfirmation: departmentRoleToUserRole(value) === UserRole.ADMIN,
      })),
      defaultParty: DEFAULT_PARTY,
    };
  }

  async getManagers(actor: Actor) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const staff = await userRepository.findStaffByOrganization(orgId);
    return staff
      .filter((u) => u.isActive !== false)
      .map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
      }));
  }

  async list(actor: Actor, query: UserManagementListQuery) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    await invitationRepository.expireStale(orgId);

    const invitations = await invitationRepository.findByOrg(orgId);
    const invitedEmails = new Set(invitations.map((inv) => inv.email.toLowerCase()));
    const staff = await userRepository.findStaffByOrganization(orgId);
    const allRows = [
      ...invitations.map(toManagedUser),
      ...staff.filter((user) => !invitedEmails.has(user.email.toLowerCase())).map(staffToManagedUser),
    ];

    const counts = {
      all: allRows.length,
      pendingApproval: allRows.filter((row) => isApprovalOpen(row.approvalStatus)).length,
      overdue: allRows.filter((row) => row.isOverdue).length,
      approved: allRows.filter((row) => row.approvalStatus === ApprovalStatus.APPROVED).length,
      rejected: allRows.filter((row) => row.approvalStatus === ApprovalStatus.REJECTED).length,
      active: allRows.filter((row) => row.accountStatus === AccountStatus.ACTIVE).length,
      inactive: allRows.filter((row) => row.accountStatus === AccountStatus.INACTIVE).length,
    };

    let rows = allRows;
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          row.role.toLowerCase().includes(q) ||
          (row.jobTitle ?? '').toLowerCase().includes(q) ||
          (row.district ?? '').toLowerCase().includes(q) ||
          (row.taluk ?? '').toLowerCase().includes(q) ||
          (row.city ?? '').toLowerCase().includes(q) ||
          (row.partyRole ?? '').toLowerCase().includes(q) ||
          (row.party ?? '').toLowerCase().includes(q)
      );
    }

    rows = rows.filter((row) => matchesFilter(row, query.filter));

    return { users: rows, counts };
  }

  async listOverdue(actor: Actor) {
    const result = await this.list(actor, { filter: 'overdue' });
    return {
      items: result.users.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        pendingAction: row.pendingAction,
        nextAction: row.nextAction,
        pendingSince: row.pendingSince,
        invitationStatus: row.invitationStatus,
        approvalStatus: row.approvalStatus,
        accountStatus: row.accountStatus,
        isOverdue: true,
      })),
    };
  }

  async getDetails(actor: Actor, invitationId: string) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const invitation = await invitationRepository.findById(invitationId);
    if (invitation && invitation.organizationId === orgId) {
      const targetIds = [String(invitation._id)];
      if (invitation.user) {
        targetIds.push(linkedId(invitation.user));
      }
      const audit = await auditRepository.findByTarget(targetIds);
      return {
        user: toManagedUser(invitation),
        audit: audit.map(toAuditDto),
      };
    }

    const staff = await userRepository.findByIdInOrg(invitationId, orgId);
    if (!staff || ![UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(staff.role)) {
      throw new ApiError(404, 'Invitation not found');
    }
    const audit = await auditRepository.findByTarget([String(staff._id)]);
    return {
      user: staffToManagedUser(staff),
      audit: audit.map(toAuditDto),
    };
  }

  async invite(actor: Actor, input: InviteUserInput) {
    const admin = await this.loadActor(actor);
    const role = departmentRoleToUserRole(input.departmentRole);
    assertCanAssignRole(actor, role);

    const email = input.email.toLowerCase().trim();
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ApiError(409, 'Email is already registered');
    }

    const orgId = resolveOrganizationId(admin);
    const openInvite = await invitationRepository.findOpenByEmail(orgId, email);
    if (openInvite) {
      throw new ApiError(409, 'An open invitation already exists for this email');
    }

    const dept = await departmentRepository.findById(input.department);
    if (!dept || !dept.isActive) throw new ApiError(400, 'Department not found');

    if (input.reportingManager) {
      const manager = await userRepository.findByIdInOrg(input.reportingManager, orgId);
      if (!manager || ![UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(manager.role)) {
        throw new ApiError(400, 'Reporting manager must be a staff member in your organization');
      }
    }

    const posting = await locationService.resolvePosting(input.district, input.taluk, input.city);

    const token = generateToken();
    const invitation = await invitationRepository.create({
      organizationId: orgId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      phone: input.phone.trim(),
      jobTitle: input.jobTitle.trim(),
      department: new Types.ObjectId(input.department),
      company: input.company.trim(),
      district: posting.district,
      taluk: posting.taluk,
      city: posting.city,
      partyRole: input.partyRole.trim(),
      party: input.party.trim(),
      departmentRole: input.departmentRole,
      role,
      accessLevel: defaultAccessLevel(role, input.accessLevel),
      reportingManager: optionalObjectId(input.reportingManager),
      additionalInformation: input.additionalInformation?.trim(),
      invitationStatus: InvitationStatus.SENT,
      approvalStatus: ApprovalStatus.PENDING,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      invitedBy: new Types.ObjectId(admin._id.toString()),
      invitedAt: new Date(),
    });

    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'invitation',
      targetId: String(invitation._id),
      targetEmail: email,
      action: AuditAction.INVITATION_CREATED,
      newStatus: InvitationStatus.SENT,
      metadata: {
        role,
        departmentRole: input.departmentRole,
        department: dept.name,
        accessLevel: invitation.accessLevel,
      },
    });
    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'invitation',
      targetId: String(invitation._id),
      targetEmail: email,
      action: AuditAction.ROLE_ASSIGNED,
      newStatus: role,
    });
    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'invitation',
      targetId: String(invitation._id),
      targetEmail: email,
      action: AuditAction.APPROVAL_REQUESTED,
      newStatus: ApprovalStatus.PENDING,
    });

    try {
      await this.sendInviteEmail(invitation, token, admin.name);
      await this.recordAudit({
        organizationId: orgId,
        actor,
        targetType: 'invitation',
        targetId: String(invitation._id),
        targetEmail: email,
        action: AuditAction.INVITATION_SENT,
        previousStatus: InvitationStatus.SENT,
        newStatus: InvitationStatus.SENT,
      });
    } catch (error) {
      logger.error('Failed to send staff invitation email', {
        email,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        'Invitation was created but email could not be sent. Open the user and resend, or configure SMTP.'
      );
    }

    const created = await invitationRepository.findById(String(invitation._id));
    return {
      user: toManagedUser(created ?? invitation),
      ...(env.NODE_ENV === 'development' ? { token } : {}),
    };
  }

  async resend(actor: Actor, invitationId: string) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const invitation = await this.requireOrgInvitation(invitationId, orgId);

    if (invitation.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ApiError(400, 'Cannot resend a rejected invitation');
    }
    if (invitation.invitationStatus === InvitationStatus.ACCEPTED) {
      throw new ApiError(400, 'Invitation has already been accepted');
    }

    const token = generateToken();
    const updated = await invitationRepository.updateById(invitationId, {
      tokenHash: hashToken(token),
      invitationStatus: InvitationStatus.SENT,
      expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      invitedAt: new Date(),
    });
    if (!updated) throw new ApiError(404, 'Invitation not found');

    await this.sendInviteEmail(updated, token, admin.name);
    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'invitation',
      targetId: invitationId,
      targetEmail: updated.email,
      action: AuditAction.INVITATION_SENT,
      previousStatus: invitation.invitationStatus,
      newStatus: InvitationStatus.SENT,
    });

    return {
      user: toManagedUser(updated),
      ...(env.NODE_ENV === 'development' ? { token } : {}),
    };
  }

  async approve(actor: Actor, invitationId: string, requestedRole?: UserRole) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const invitation = await this.requireOrgInvitation(invitationId, orgId);

    if (invitation.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ApiError(400, 'Rejected invitations cannot be approved');
    }
    if (requestedRole && requestedRole !== invitation.role) {
      throw new ApiError(400, 'Approved role must match the invitation role');
    }

    const previous = invitation.approvalStatus;
    const updates: Record<string, unknown> = {
      approvalStatus: ApprovalStatus.APPROVED,
      approvedBy: new Types.ObjectId(admin._id.toString()),
      approvedAt: new Date(),
      resolutionNote: undefined,
    };

    const linkedUser = await this.resolveLinkedUser(invitation, orgId);
    if (linkedUser) {
      if (linkedUser.role !== invitation.role) {
        throw new ApiError(400, 'User role does not match the invitation role');
      }
      await userRepository.updateById(String(linkedUser._id), {
        isActive: true,
        role: invitation.role,
        accessLevel: invitation.accessLevel,
      });
      await this.recordAudit({
        organizationId: orgId,
        actor,
        targetType: 'user',
        targetId: String(linkedUser._id),
        targetEmail: linkedUser.email,
        action: AuditAction.USER_ACTIVATED,
        previousStatus: linkedUser.isActive === false ? AccountStatus.INACTIVE : AccountStatus.ACTIVE,
        newStatus: AccountStatus.ACTIVE,
      });
    }

    const updated = await invitationRepository.updateById(invitationId, updates);
    if (!updated) throw new ApiError(404, 'Invitation not found');

    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'invitation',
      targetId: invitationId,
      targetEmail: invitation.email,
      action: AuditAction.APPROVED,
      previousStatus: previous,
      newStatus: ApprovalStatus.APPROVED,
      metadata: { role: invitation.role },
    });

    return { user: toManagedUser(updated) };
  }

  async reject(actor: Actor, invitationId: string, input: RejectInvitationInput) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const invitation = await this.requireOrgInvitation(invitationId, orgId);

    if (invitation.approvalStatus === ApprovalStatus.APPROVED && invitation.invitationStatus === InvitationStatus.ACCEPTED) {
      throw new ApiError(400, 'Approved active users must be deactivated instead of rejected');
    }

    const previous = invitation.approvalStatus;
    const linkedUser = await this.resolveLinkedUser(invitation, orgId);
    if (linkedUser) {
      await userRepository.updateById(String(linkedUser._id), { isActive: false });
      await this.recordAudit({
        organizationId: orgId,
        actor,
        targetType: 'user',
        targetId: String(linkedUser._id),
        targetEmail: linkedUser.email,
        action: AuditAction.USER_DEACTIVATED,
        previousStatus: linkedUser.isActive === false ? AccountStatus.INACTIVE : AccountStatus.ACTIVE,
        newStatus: AccountStatus.INACTIVE,
      });
    }

    const updated = await invitationRepository.updateById(invitationId, {
      approvalStatus: ApprovalStatus.REJECTED,
      approvedBy: new Types.ObjectId(admin._id.toString()),
      rejectedAt: new Date(),
      rejectionReason: input.reason?.trim(),
    });
    if (!updated) throw new ApiError(404, 'Invitation not found');

    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'invitation',
      targetId: invitationId,
      targetEmail: invitation.email,
      action: AuditAction.REJECTED,
      previousStatus: previous,
      newStatus: ApprovalStatus.REJECTED,
      metadata: { reason: input.reason },
    });

    return { user: toManagedUser(updated) };
  }

  async keepPending(actor: Actor, invitationId: string, input: KeepPendingInput) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const invitation = await this.requireOrgInvitation(invitationId, orgId);

    if (invitation.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ApiError(400, 'Rejected invitations cannot be kept pending');
    }

    const previous = invitation.approvalStatus;
    const updated = await invitationRepository.updateById(invitationId, {
      approvalStatus: ApprovalStatus.KEEP_PENDING,
      approvedBy: new Types.ObjectId(admin._id.toString()),
      resolutionNote: input.note.trim(),
    });
    if (!updated) throw new ApiError(404, 'Invitation not found');

    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'invitation',
      targetId: invitationId,
      targetEmail: invitation.email,
      action: AuditAction.KEEP_PENDING,
      previousStatus: previous,
      newStatus: ApprovalStatus.KEEP_PENDING,
      metadata: { note: input.note },
    });

    return { user: toManagedUser(updated) };
  }

  async setUserActive(actor: Actor, userId: string, isActive: boolean) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const user = await userRepository.findByIdInOrg(userId, orgId);
    if (!user) throw new ApiError(404, 'User not found in your organization');
    if (String(user._id) === actor.userId) {
      throw new ApiError(400, 'You cannot change your own account status');
    }

    const previous = user.isActive === false ? AccountStatus.INACTIVE : AccountStatus.ACTIVE;
    const updated = await userRepository.updateById(userId, { isActive });
    if (!updated) throw new ApiError(404, 'User not found');

    await this.recordAudit({
      organizationId: orgId,
      actor,
      targetType: 'user',
      targetId: userId,
      targetEmail: user.email,
      action: isActive ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
      previousStatus: previous,
      newStatus: isActive ? AccountStatus.ACTIVE : AccountStatus.INACTIVE,
    });

    return {
      id: String(updated._id),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive !== false,
    };
  }

  async listAudit(actor: Actor) {
    const admin = await this.loadActor(actor);
    const orgId = resolveOrganizationId(admin);
    const events = await auditRepository.findByOrg(orgId);
    return events.map(toAuditDto);
  }

  async verifyToken(token: string) {
    const invitation = await invitationRepository.findByTokenHash(hashToken(token));
    if (!invitation) throw new ApiError(404, 'Invitation not found');
    this.assertAcceptable(invitation);
    return {
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      role: invitation.role,
      company: invitation.company,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(input: AcceptInvitationInput) {
    const invitation = await invitationRepository.findByTokenHash(hashToken(input.token));
    if (!invitation) throw new ApiError(404, 'Invitation not found');
    this.assertAcceptable(invitation);

    if (invitation.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ApiError(400, 'This invitation was rejected');
    }

    const existing = await userRepository.findByEmail(invitation.email);
    if (existing) throw new ApiError(409, 'Email is already registered');

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
    const isApproved = invitation.approvalStatus === ApprovalStatus.APPROVED;
    const departmentId =
      invitation.department && typeof invitation.department === 'object' && '_id' in invitation.department
        ? (invitation.department as { _id: Types.ObjectId })._id
        : invitation.department;
    const managerId =
      invitation.reportingManager &&
      typeof invitation.reportingManager === 'object' &&
      '_id' in invitation.reportingManager
        ? (invitation.reportingManager as { _id: Types.ObjectId })._id
        : invitation.reportingManager;

    const user = await userRepository.create({
      name: `${invitation.firstName} ${invitation.lastName}`.trim(),
      email: invitation.email,
      password: hashedPassword,
      role: invitation.role,
      organizationId: invitation.organizationId,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      phone: invitation.phone,
      jobTitle: invitation.jobTitle,
      company: invitation.company,
      district: invitation.district,
      taluk: invitation.taluk,
      city: invitation.city,
      partyRole: invitation.partyRole,
      party: invitation.party,
      departmentRole: invitation.departmentRole,
      accessLevel: invitation.accessLevel,
      reportingManager: managerId as Types.ObjectId | undefined,
      additionalInformation: invitation.additionalInformation,
      department: departmentId as Types.ObjectId | undefined,
      invitation: invitation._id as Types.ObjectId,
      isActive: isApproved,
    });

    const updated = await invitationRepository.updateById(String(invitation._id), {
      invitationStatus: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
      user: user._id,
    });

    await this.recordAudit({
      organizationId: invitation.organizationId,
      targetType: 'invitation',
      targetId: String(invitation._id),
      targetEmail: invitation.email,
      action: AuditAction.INVITATION_ACCEPTED,
      previousStatus: InvitationStatus.SENT,
      newStatus: InvitationStatus.ACCEPTED,
    });
    await this.recordAudit({
      organizationId: invitation.organizationId,
      targetType: 'user',
      targetId: String(user._id),
      targetEmail: user.email,
      action: AuditAction.ROLE_ASSIGNED,
      newStatus: invitation.role,
    });
    if (isApproved) {
      await this.recordAudit({
        organizationId: invitation.organizationId,
        targetType: 'user',
        targetId: String(user._id),
        targetEmail: user.email,
        action: AuditAction.USER_ACTIVATED,
        newStatus: AccountStatus.ACTIVE,
      });
    } else {
      await this.recordAudit({
        organizationId: invitation.organizationId,
        targetType: 'invitation',
        targetId: String(invitation._id),
        targetEmail: invitation.email,
        action: AuditAction.APPROVAL_REQUESTED,
        newStatus: invitation.approvalStatus,
      });
    }

    return {
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive !== false,
      },
      invitation: updated ? toManagedUser(updated) : undefined,
      pendingApproval: !isApproved,
    };
  }

  private assertAcceptable(invitation: IInvitation): void {
    if (invitation.invitationStatus === InvitationStatus.ACCEPTED) {
      throw new ApiError(400, 'Invitation has already been accepted');
    }
    if (
      invitation.invitationStatus === InvitationStatus.EXPIRED ||
      invitation.expiresAt.getTime() < Date.now()
    ) {
      throw new ApiError(400, 'Invitation has expired');
    }
  }

  private async requireOrgInvitation(id: string, organizationId: string): Promise<IInvitation> {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(400, 'Invalid invitation id');
    const invitation = await invitationRepository.findById(id);
    if (!invitation || invitation.organizationId !== organizationId) {
      throw new ApiError(404, 'Invitation not found');
    }
    return invitation;
  }

  private async resolveLinkedUser(invitation: IInvitation, organizationId: string): Promise<IUser | null> {
    if (!invitation.user) return null;
    return userRepository.findByIdInOrg(linkedId(invitation.user), organizationId);
  }
}

function linkedId(value: unknown): string {
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

export const userManagementService = new UserManagementService();
