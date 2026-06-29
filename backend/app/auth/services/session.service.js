const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../../db/prisma');

const TOKEN_HASH_ROUNDS = 12;

function digestToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function hashToken(token) {
  if (!token) {
    throw new Error('Refresh token is required.');
  }

  return bcrypt.hash(digestToken(token), TOKEN_HASH_ROUNDS);
}

async function findMatchingSession(client, { userId, refreshToken }) {
  const sessions = await client.refreshSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  for (const session of sessions) {
    if (await bcrypt.compare(digestToken(refreshToken), session.tokenHash)) {
      return session;
    }
  }

  return null;
}

async function createSession({ userId, refreshToken, expiresAt }, client = prisma) {
  const tokenHash = await hashToken(refreshToken);

  return client.refreshSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

async function findSessionByToken({ userId, refreshToken }) {
  return findMatchingSession(prisma, { userId, refreshToken });
}

async function rotateSession({
  userId,
  refreshToken,
  newRefreshToken,
  newExpiresAt,
}) {
  const newTokenHash = await hashToken(newRefreshToken);

  return prisma.$transaction(async (tx) => {
    const currentSession = await findMatchingSession(tx, {
      userId,
      refreshToken,
    });

    if (!currentSession || currentSession.revokedAt || currentSession.expiresAt <= new Date()) {
      return null;
    }

    const revoked = await tx.refreshSession.updateMany({
      where: {
        id: currentSession.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) {
      return null;
    }

    return tx.refreshSession.create({
      data: {
        userId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });
  });
}

async function revokeSession({ userId, refreshToken }) {
  return prisma.$transaction(async (tx) => {
    const session = await findMatchingSession(tx, { userId, refreshToken });

    if (!session || session.revokedAt) {
      return null;
    }

    return tx.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  });
}

module.exports = {
  createSession,
  findSessionByToken,
  rotateSession,
  revokeSession,
};
