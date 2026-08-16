import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_1234567890';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_1234567890';
  // connect mongoose
  await mongoose.connect(uri, { } as any);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  // clear all collections
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    const coll = collections[key];
    try {
      await coll.deleteMany({});
    } catch (err) {
      // ignore
    }
  }
});
