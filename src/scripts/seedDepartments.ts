import { connectDatabase, disconnectDatabase } from '../config/database';
import { departmentService } from '../services/department.service';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  await connectDatabase();
  const stats = await departmentService.seed({ force: false });
  logger.info('Service department seed complete', stats);
  console.log(JSON.stringify(stats, null, 2));
  await disconnectDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
