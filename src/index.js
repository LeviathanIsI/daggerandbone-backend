import mongoose from 'mongoose';
import { createApp } from './app.js';
import { readConfig, assertServerConfig } from './config.js';
import { seedDatabase } from './seed.js';
import { errorDetails } from './error-details.js';

const config = readConfig();
assertServerConfig(config);
let server;
let startupStep = 'MongoDB connection';
try {
  await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, serverSelectionTimeoutMS: 10000 });
  startupStep = 'database setup';
  await seedDatabase();
  startupStep = 'HTTP listener';
  const app = createApp(config);
  server = app.listen(config.port, () => console.log(`Backend listening on port ${config.port}`));
} catch (error) {
  console.error('Backend startup failed', { step: startupStep, ...errorDetails(error, config) });
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
}

async function shutdown() {
  server.close();
  await mongoose.disconnect();
}
if (server) {
  process.on('SIGINT', () => { shutdown().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { shutdown().then(() => process.exit(0)); });
}
