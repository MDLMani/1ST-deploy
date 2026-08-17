import { connectDatabase, disconnectDatabase } from '../config/database';
import { seedDefaultAdmin } from '../services/defaultAdmin.service';
import { env } from '../config/env';

async function main(): Promise<void> {
  await connectDatabase();
  await seedDefaultAdmin();
  console.log(`Default admin ready: ${env.DEFAULT_ADMIN_EMAIL}`);
  await disconnectDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
