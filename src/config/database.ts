import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let memoryServer: { stop: () => Promise<boolean> } | null = null;

async function resolveMongoUri(): Promise<string> {
  if (env.MONGODB_URI !== 'memory') {
    return env.MONGODB_URI;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI=memory is not allowed in production');
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  memoryServer = mongod;
  const uri = mongod.getUri();
  logger.warn('Using in-memory MongoDB (dev only). Data is lost when the server stops.');
  return uri;
}

export const connectDatabase = async (): Promise<void> => {
  try {
    const uri = await resolveMongoUri();
    await mongoose.connect(uri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err });
  });
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  logger.info('MongoDB disconnected');
};
