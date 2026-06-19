export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPPORT_AGENT = 'support_agent',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
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
} as const;
