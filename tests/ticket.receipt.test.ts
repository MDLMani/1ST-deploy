import './setup';
import { renderTicketClosureReceiptEmail } from '../src/templates/email.templates';

describe('ticket closure receipt email', () => {
  test('renders a receipt summary with assignee and section head details', () => {
    const { subject, html, text } = renderTicketClosureReceiptEmail({
      ticketNumber: 'TVK-2025-000123',
      title: 'Streetlight outage',
      status: 'RESOLVED',
      complaintSummary: 'Streetlight at Main Road is not functioning for 3 days.',
      assignedTo: 'R. Kumar',
      assignedToEmail: 'r.kumar@tvk.in',
      departmentName: 'Municipal / Local Body',
      sectionHeadName: 'S. Meena',
      sectionHeadEmail: 's.meena@tvk.in',
      closedAt: '2025-01-20T10:30:00.000Z',
    });

    expect(subject).toContain('TVK-2025-000123');
    expect(html).toContain('R. Kumar');
    expect(html).toContain('S. Meena');
    expect(text).toContain('Streetlight outage');
    expect(text).toContain('Municipal / Local Body');
  });
});
