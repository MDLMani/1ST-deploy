export const OTP_EXPIRY_MINUTES = 10;

export interface PasswordResetOtpTemplateVars {
  name: string;
  otp: string;
  expiryMinutes?: number;
}

export function renderPasswordResetOtpEmail(vars: PasswordResetOtpTemplateVars) {
  const expiryMinutes = vars.expiryMinutes ?? OTP_EXPIRY_MINUTES;
  const subject = `${vars.otp} is your TVK Support password reset code`;

  const text = [
    `Hi ${vars.name},`,
    '',
    'We received a request to reset your TVK Support account password.',
    '',
    `Your one-time password (OTP): ${vars.otp}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    'Do not share this code with anyone.',
    '',
    'If you did not request a password reset, you can safely ignore this email.',
    '',
    '— Tamilaga Vettri Kazhagam Support',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background:#0f0f12;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0f12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#18181f;border:1px solid #2a2a35;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#c8102e 0%,#8b0a1f 55%,#f4c430 140%);">
              <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.85);">TVK Support</p>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;color:#ffffff;">Password Reset Code</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e5e7eb;">Hi ${escapeHtml(vars.name)},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#cbd5e1;">
                Use the verification code below to reset your password. This code expires in
                <strong style="color:#ffffff;">${expiryMinutes} minutes</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:20px;border-radius:16px;background:#111118;border:1px dashed #f4c430;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Your OTP</p>
                    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:10px;color:#ffffff;">${escapeHtml(vars.otp)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#94a3b8;">
                Enter this code on the forgot password screen, then choose a new password.
              </p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                If you did not request this, ignore this email. Your password will stay unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #2a2a35;background:#121218;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
                Tamilaga Vettri Kazhagam — Support System<br />
                Do not share this code with anyone.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export interface StaffInvitationTemplateVars {
  firstName: string;
  inviterName: string;
  roleLabel: string;
  organization: string;
  token: string;
  acceptUrl?: string;
  expiryDays: number;
}

export interface TicketClosureReceiptTemplateVars {
  ticketNumber: string;
  title: string;
  status: string;
  complaintSummary: string;
  assignedTo: string;
  assignedToEmail?: string;
  departmentName: string;
  sectionHeadName?: string;
  sectionHeadEmail?: string;
  closedAt: string;
}

export function renderTicketClosureReceiptEmail(vars: TicketClosureReceiptTemplateVars) {
  const subject = `Ticket receipt ${vars.ticketNumber} — ${vars.status}`;
  const statusLabel = vars.status === 'CLOSED' ? 'Closed' : 'Resolved';
  const assigned = vars.assignedTo || 'Awaiting assignment';
  const sectionHead = vars.sectionHeadName || 'Department oversight';
  const sectionHeader = `Complaint ${statusLabel.toLowerCase()} successfully`;

  const text = [
    `Hello,`,
    '',
    `Here is the closure receipt for ticket ${vars.ticketNumber}.`,
    '',
    `Title: ${vars.title}`,
    `Status: ${vars.status}`,
    `Department: ${vars.departmentName}`,
    `Complaint summary: ${vars.complaintSummary}`,
    `Assigned to: ${assigned}${vars.assignedToEmail ? ` (${vars.assignedToEmail})` : ''}`,
    `Section head: ${sectionHead}${vars.sectionHeadEmail ? ` (${vars.sectionHeadEmail})` : ''}`,
    `Closed on: ${new Date(vars.closedAt).toLocaleString()}`,
    '',
    'Thank you for using the TVK support system.',
    '',
    '— Tamilaga Vettri Kazhagam Support',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket closure receipt</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:22px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px 18px;background:linear-gradient(135deg,#0f766e 0%,#0ea5e9 50%,#f59e0b 110%);">
              <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.85);">TVK Support</p>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.25;color:#ffffff;">${escapeHtml(sectionHeader)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">Hello,</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;">
                Your complaint ticket <strong style="color:#0f172a;">${escapeHtml(vars.ticketNumber)}</strong> has been ${escapeHtml(statusLabel.toLowerCase())}. Below is the detailed closure summary.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
                <tr>
                  <td style="padding:18px 18px 12px;">
                    <p style="margin:0 0 12px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Ticket summary</p>
                    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">${escapeHtml(vars.title)}</p>
                    <p style="margin:0;color:#475569;line-height:1.7;">${escapeHtml(vars.complaintSummary)}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                <tr>
                  <td style="padding:12px 0;vertical-align:top;width:50%;">
                    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Assigned to</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(assigned)}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#475569;">${escapeHtml(vars.assignedToEmail || 'No email provided')}</p>
                  </td>
                  <td style="padding:12px 0;vertical-align:top;width:50%;">
                    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Section head</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(sectionHead)}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#475569;">${escapeHtml(vars.sectionHeadEmail || 'No contact available')}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:8px;">
                    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Department</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(vars.departmentName)}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:14px;">
                    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Closed on</p>
                    <p style="margin:0;font-size:14px;color:#334155;">${escapeHtml(new Date(vars.closedAt).toLocaleString())}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 26px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">
                Tamilaga Vettri Kazhagam — Support System<br />
                This document is generated automatically after the complaint is closed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function renderStaffInvitationEmail(vars: StaffInvitationTemplateVars) {
  const subject = `You're invited to join ${vars.organization} support on TVK`;
  const acceptLine = vars.acceptUrl
    ? `Accept your invitation: ${vars.acceptUrl}`
    : `Use this invitation token to accept: ${vars.token}`;

  const text = [
    `Hi ${vars.firstName},`,
    '',
    `${vars.inviterName} invited you to join ${vars.organization} as ${vars.roleLabel}.`,
    '',
    acceptLine,
    '',
    `This invitation expires in ${vars.expiryDays} days.`,
    '',
    'If you were not expecting this, you can ignore this email.',
    '',
    '— Tamilaga Vettri Kazhagam Support',
  ].join('\n');

  const cta = vars.acceptUrl
    ? `<a href="${escapeHtml(vars.acceptUrl)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#c8102e;color:#ffffff;font-weight:700;text-decoration:none;">Accept invitation</a>
       <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Or use token: <code style="color:#f4c430;">${escapeHtml(vars.token)}</code></p>`
    : `<p style="margin:0;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Invitation token</p>
       <p style="margin:8px 0 0;font-size:18px;font-weight:700;letter-spacing:2px;color:#ffffff;word-break:break-all;">${escapeHtml(vars.token)}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TVK staff invitation</title>
</head>
<body style="margin:0;padding:0;background:#0f0f12;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0f12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#18181f;border:1px solid #2a2a35;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#c8102e 0%,#8b0a1f 55%,#f4c430 140%);">
              <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.85);">TVK Support</p>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;color:#ffffff;">Staff invitation</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e5e7eb;">Hi ${escapeHtml(vars.firstName)},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#cbd5e1;">
                <strong style="color:#ffffff;">${escapeHtml(vars.inviterName)}</strong> invited you to join
                <strong style="color:#ffffff;">${escapeHtml(vars.organization)}</strong> as
                <strong style="color:#f4c430;">${escapeHtml(vars.roleLabel)}</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:20px;border-radius:16px;background:#111118;border:1px dashed #f4c430;">
                    ${cta}
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#94a3b8;">
                This invitation expires in <strong style="color:#ffffff;">${vars.expiryDays} days</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #2a2a35;background:#121218;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
                Tamilaga Vettri Kazhagam — Support System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
