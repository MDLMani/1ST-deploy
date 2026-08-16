import './setup';
import { sendVerificationCode, verifyCode } from '../src/services/sms.service';
import { phoneVerificationRepository } from '../src/repositories/phoneVerification.repository';

describe('SMS service', () => {
  const phone = '+15550001111';

  test('sends verification code and verifies it', async () => {
    const ok = await sendVerificationCode(null, phone);
    expect(ok).toBe(true);

    const active = await phoneVerificationRepository.findActiveByPhone(phone);
    expect(active).toBeTruthy();
    expect(active!.code).toHaveLength(6);

    const res = await verifyCode(phone, active!.code);
    expect(res.ok).toBe(true);

    const after = await phoneVerificationRepository.findActiveByPhone(phone);
    expect(after).toBeNull();
  });

  test('invalid code increments attempts and returns invalid_code', async () => {
    await sendVerificationCode(null, phone);
    const active = await phoneVerificationRepository.findActiveByPhone(phone);
    expect(active).toBeTruthy();

    const r1 = await verifyCode(phone, '000000');
    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe('invalid_code');

    const refreshed = await phoneVerificationRepository.findActiveByPhone(phone);
    expect(refreshed!.attempts).toBeGreaterThanOrEqual(1);
  });
});
