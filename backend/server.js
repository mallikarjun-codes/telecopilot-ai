'use strict';

const http = require('http');

const app = require('./app');
const env = require('./app/config/env');
const prisma = require('./app/db/prisma');

const server = http.createServer(app);

async function start() {
  try {
    // Verify database connection
    await prisma.$connect();

    server.listen(env.port, () => {
      console.log(
        `🚀 Server running on http://localhost:${env.port} (${env.nodeEnv})`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  await prisma.$disconnect();

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();