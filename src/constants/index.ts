export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPPORT_AGENT = 'support_agent',
}

/** Staff roles an admin may assign when inviting. Citizen `user` self-registers. */
export const ASSIGNABLE_STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPPORT_AGENT];

export enum InvitationStatus {
  SENT = 'sent',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  /** Admin put the request on hold (In Review). */
  KEEP_PENDING = 'keep_pending',
  /** First approval done — staff must complete invite profile form. */
  AWAITING_PROFILE = 'awaiting_profile',
  /** Profile submitted — waiting for final admin approval to unlock app. */
  PROFILE_SUBMITTED = 'profile_submitted',
}

export enum InvitationSource {
  ADMIN_INVITE = 'admin_invite',
  SELF_SIGNUP = 'self_signup',
}

export enum AccessLevel {
  FULL = 'full',
  STANDARD = 'standard',
  LIMITED = 'limited',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  NONE = 'none',
}

export enum AuditAction {
  INVITATION_CREATED = 'invitation_created',
  INVITATION_SENT = 'invitation_sent',
  INVITATION_ACCEPTED = 'invitation_accepted',
  ROLE_ASSIGNED = 'role_assigned',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  KEEP_PENDING = 'keep_pending',
  USER_ACTIVATED = 'user_activated',
  USER_DEACTIVATED = 'user_deactivated',
  PROFILE_AWAITING = 'profile_awaiting',
  PROFILE_SUBMITTED = 'profile_submitted',
  SELF_SIGNUP_QUEUED = 'self_signup_queued',
}

export const DEFAULT_ORGANIZATION_ID = 'tvk';
export const DEFAULT_PARTY = 'Tamilaga Vettri Kazhagam (TVK)';
export const INVITATION_EXPIRY_DAYS = 7;
export const APPROVAL_OVERDUE_HOURS = 48;

/** Suggested values for invitation `partyRole` (free-text also allowed). */
export const PARTY_ROLES = [
  'member',
  'booth_agent',
  'ward_secretary',
  'district_secretary',
  'office_bearer',
  'volunteer',
  'other',
] as const;

export type PartyRole = (typeof PARTY_ROLES)[number];

/** Canonical LGD district names (38). Aliases are resolved in location.service. */
export const TAMIL_NADU_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kancheepuram',
  'Kanniyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'The Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukkudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Thiruvallur',
  'Tiruvannamalai',
  'Thiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar',
] as const;

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  MERGED = 'MERGED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** @deprecated Prefer seeded Department documents; kept for legacy slug references. */
export enum Department {
  GENERAL = 'general',
  BILLING = 'billing',
  TECH_SUPPORT = 'tech_support',
  SALES = 'sales',
  FEATURE_REQUEST = 'feature_request',
}

/** Role label within a service department (RBAC `role` stays admin | support_agent). */
export enum DepartmentRole {
  DEPARTMENT_ADMIN = 'department_admin',
  SUPPORT_AGENT = 'support_agent',
  COORDINATOR = 'coordinator',
}

export const DEPARTMENT_ROLE_LABELS: Record<DepartmentRole, string> = {
  [DepartmentRole.DEPARTMENT_ADMIN]: 'Department Admin',
  [DepartmentRole.SUPPORT_AGENT]: 'Support Agent / Officer',
  [DepartmentRole.COORDINATOR]: 'Coordinator',
};

/** Maps department role label → system RBAC role. */
export function departmentRoleToUserRole(departmentRole: DepartmentRole): UserRole {
  if (departmentRole === DepartmentRole.DEPARTMENT_ADMIN) return UserRole.ADMIN;
  return UserRole.SUPPORT_AGENT;
}

/** Canonical TVK / Tamil Nadu citizen-helpdesk departments (seeded into Mongo). */
export const SERVICE_DEPARTMENTS = [
  { name: 'Electricity', slug: 'electricity', description: 'TNEB / TANGEDCO power supply and billing issues' },
  { name: 'Water', slug: 'water', description: 'Drinking water supply, tankers, and pipeline complaints' },
  { name: 'MLA / Constituency Office', slug: 'mla-constituency', description: 'MLA office and constituency grievance desk' },
  { name: 'Road / Public Works', slug: 'road-public-works', description: 'Roads, PWD, bridges, and street infrastructure' },
  { name: 'Sanitation', slug: 'sanitation', description: 'Garbage, drainage, toilets, and public cleanliness' },
  { name: 'Ration / PDS', slug: 'ration-pds', description: 'Ration card and Public Distribution System issues' },
  { name: 'Police / Law & Order', slug: 'police-law-order', description: 'Law & order escalation and police helpdesk routing' },
  { name: 'Health', slug: 'health', description: 'PHCs, hospitals, and public health services' },
  { name: 'Education', slug: 'education', description: 'Schools, colleges, and education department grievances' },
  { name: 'Transport', slug: 'transport', description: 'Bus, transport corporation, and traffic-related issues' },
  { name: 'Revenue / Taluk Office', slug: 'revenue-taluk', description: 'Revenue, taluk, and certificate-related services' },
  { name: 'Municipal / Local Body', slug: 'municipal-local-body', description: 'Corporation, municipality, and panchayat services' },
  { name: 'Women & Child', slug: 'women-child', description: 'Women and child welfare schemes and support' },
  { name: 'Agriculture', slug: 'agriculture', description: 'Farmers, subsidies, and agriculture department help' },
  { name: 'Disaster / Emergency', slug: 'disaster-emergency', description: 'Flood, cyclone, fire, and emergency response' },
  { name: 'Membership / Party Organization', slug: 'membership-party', description: 'TVK membership and party organizational matters' },
  { name: 'Media / Communications', slug: 'media-communications', description: 'Press, media desk, and communications requests' },
  { name: 'Other / General', slug: 'other-general', description: 'General grievances not covered by other departments' },
] as const;

export enum AssignmentStrategy {
  MANUAL = 'manual',
  ROUND_ROBIN = 'round_robin',
  LOAD_BALANCED = 'load_balanced',
  SKILL_BASED = 'skill_based',
}

export enum EscalationTrigger {
  TIME_BASED = 'time_based',
  PRIORITY_CHANGE = 'priority_change',
  CUSTOMER_REPLY = 'customer_reply',
  SLA_BREACH = 'sla_breach',
}

export enum SatisfactionRating {
  VERY_UNSATISFIED = 1,
  UNSATISFIED = 2,
  NEUTRAL = 3,
  SATISFIED = 4,
  VERY_SATISFIED = 5,
}

/** Hours before a ticket is marked overdue by priority */
export const OVERDUE_THRESHOLDS_HOURS: Record<TicketPriority, number> = {
  [TicketPriority.CRITICAL]: 12,
  [TicketPriority.HIGH]: 24,
  [TicketPriority.MEDIUM]: 48,
  [TicketPriority.LOW]: 72,
};

export const UNRESOLVED_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
];

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const SOCKET_EVENTS = {
  TICKET_CREATED: 'ticketCreated',
  TICKET_UPDATED: 'ticketUpdated',
  TICKET_ASSIGNED: 'ticketAssigned',
  TICKET_OVERDUE: 'ticketOverdue',
  NEW_COMMENT: 'newComment',
  TICKET_MERGED: 'ticketMerged',
  SLA_BREACH: 'slaBreach',
  SLA_WARNING: 'slaWarning',
  TICKET_ESCALATED: 'ticketEscalated',
  INTERNAL_NOTE_ADDED: 'internalNoteAdded',
  SATISFACTION_SUBMITTED: 'satisfactionSubmitted',
  DRAFT_UPDATED: 'draftUpdated',
  DRAFT_DELETED: 'draftDeleted',
} as const;
