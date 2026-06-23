export type PushTemplateId =
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_OVERDUE'
  | 'NEW_COMMENT'
  | 'TICKET_RESOLVED';

export interface PushTemplateVars {
  ticketNumber?: string;
  title?: string;
  status?: string;
  senderName?: string;
  message?: string;
}

interface PushTemplate {
  title: string;
  body: (vars: PushTemplateVars) => string;
  url: (vars: PushTemplateVars) => string;
}

export const PUSH_TEMPLATES: Record<PushTemplateId, PushTemplate> = {
  TICKET_CREATED: {
    title: 'Ticket Submitted',
    body: (v) => `Your ticket #${v.ticketNumber} "${v.title}" was created successfully.`,
    url: () => '/live-updates',
  },
  TICKET_UPDATED: {
    title: 'Ticket Status Updated',
    body: (v) => `Ticket #${v.ticketNumber} is now ${v.status?.replace('_', ' ')}.`,
    url: () => '/live-updates',
  },
  TICKET_ASSIGNED: {
    title: 'Agent Assigned',
    body: (v) => `Ticket #${v.ticketNumber} has been assigned to a support agent.`,
    url: () => '/live-updates',
  },
  TICKET_OVERDUE: {
    title: 'Ticket Overdue',
    body: (v) => `Ticket #${v.ticketNumber} is overdue. Our team is prioritizing it.`,
    url: () => '/live-updates',
  },
  NEW_COMMENT: {
    title: 'New Support Reply',
    body: (v) => `${v.senderName} replied on #${v.ticketNumber}: ${v.message}`,
    url: () => '/live-updates',
  },
  TICKET_RESOLVED: {
    title: 'Ticket Resolved',
    body: (v) => `Ticket #${v.ticketNumber} has been marked as resolved.`,
    url: () => '/live-updates',
  },
};

export function renderPushTemplate(templateId: PushTemplateId, vars: PushTemplateVars) {
  const template = PUSH_TEMPLATES[templateId];
  return {
    title: template.title,
    body: template.body(vars),
    url: template.url(vars),
  };
}
