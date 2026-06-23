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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
