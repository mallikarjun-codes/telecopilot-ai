'use strict';

const prisma = require('../../db/prisma');

async function live() {
  return {
    status: 'UP',
    timestamp: new Date().toISOString(),
  };
}

async function ready() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: 'READY',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'NOT_READY',
      database: 'DISCONNECTED',
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = {
  live,
  ready,
};