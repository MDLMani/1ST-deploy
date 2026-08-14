import { connectDatabase, disconnectDatabase } from '../config/database';
import { locationService } from '../services/location.service';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  await connectDatabase();
  const stats = await locationService.seed({ force: true });
  logger.info('Tamil Nadu location seed complete', stats);
  console.log(JSON.stringify(stats, null, 2));
  await disconnectDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
