import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let memoryServer: { stop: () => Promise<boolean> } | null = null;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const isServerless = Boolean(process.env.VERCEL);

function getCache(): MongooseCache {
  if (!global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }
  return global.mongooseCache;
}

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

let listenersAttached = false;

function attachConnectionListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err });
  });
}

async function handleConnectionFailure(error: unknown): Promise<never> {
  logger.error('MongoDB connection failed', { error });

  if (isServerless) {
    throw error;
  }

  process.exit(1);
}

export const connectDatabase = async (): Promise<void> => {
  if (isServerless) {
    const cache = getCache();

    if (cache.conn && mongoose.connection.readyState === 1) {
      return;
    }

    if (!cache.promise) {
      const uri = await resolveMongoUri();
      cache.promise = mongoose
        .connect(uri, {
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        })
        .then((connection) => {
          logger.info('MongoDB connected successfully');
          attachConnectionListeners();
          return connection;
        });
    }

    try {
      cache.conn = await cache.promise;
    } catch (error) {
      cache.promise = null;
      cache.conn = null;
      await handleConnectionFailure(error);
    }

    return;
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    const uri = await resolveMongoUri();
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    logger.info('MongoDB connected successfully');
    attachConnectionListeners();
  } catch (error) {
    await handleConnectionFailure(error);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  logger.info('MongoDB disconnected');
};
