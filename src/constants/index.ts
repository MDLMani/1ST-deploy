export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPPORT_AGENT = 'support_agent',
}

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

export enum Department {
  GENERAL = 'general',
  BILLING = 'billing',
  TECH_SUPPORT = 'tech_support',
  SALES = 'sales',
  FEATURE_REQUEST = 'feature_request',
}

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
} as const;
