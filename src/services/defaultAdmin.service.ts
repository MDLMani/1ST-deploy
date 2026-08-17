import bcrypt from 'bcrypt';
import { AccessLevel, DEFAULT_ORGANIZATION_ID, UserRole } from '../constants';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;

let seedPromise: Promise<void> | null = null;

export async function seedDefaultAdmin(): Promise<void> {
  const email = env.DEFAULT_ADMIN_EMAIL.toLowerCase().trim();
  const name = env.DEFAULT_ADMIN_NAME.trim() || 'TVK Support';
  const password = env.DEFAULT_ADMIN_PASSWORD;
  const existing = await userRepository.findByEmail(email, true);

  if (!existing) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await userRepository.create({
      name,
      firstName: 'TVK',
      lastName: 'Support',
      email,
      password: hashedPassword,
      role: UserRole.ADMIN,
      accessLevel: AccessLevel.FULL,
      isActive: true,
      organizationId: DEFAULT_ORGANIZATION_ID,
    });
    logger.info('Default admin created', { email });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, existing.password);
  const alreadyReady =
    passwordMatches &&
    existing.role === UserRole.ADMIN &&
    existing.isActive !== false &&
    !existing.deletedAt &&
    existing.accessLevel === AccessLevel.FULL;

  if (alreadyReady) {
    return;
  }

  const hashedPassword = passwordMatches
    ? existing.password
    : await bcrypt.hash(password, SALT_ROUNDS);

  await userRepository.updateById(existing._id.toString(), {
    $set: {
      name,
      password: hashedPassword,
      role: UserRole.ADMIN,
      accessLevel: AccessLevel.FULL,
      isActive: true,
      organizationId: existing.organizationId || DEFAULT_ORGANIZATION_ID,
    },
    $unset: { deletedAt: 1 },
  });
  logger.info('Default admin updated', { email });
}

export async function ensureDefaultAdmin(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedDefaultAdmin().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
}
