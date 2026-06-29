const crypto = require('crypto');
const prisma = require('../../db/prisma');

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Refresh token is required.');
  }

  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSessionExpiryDate() {
  return new Date(Date.now() + DEFAULT_SESSION_TTL_MS);
}

function toPlainObject(record) {
  if (!record) {
    return null;
  }

  return { ...record };
}

async function createSession({ userId, refreshToken }) {
  if (!userId) {
    throw new Error('User id is required.');
  }

  if (!refreshToken) {
    throw new Error('Refresh token is required.');
  }

  const session = await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: getSessionExpiryDate(),
    },
  });

  return toPlainObject(session);
}

async function findSessionByToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Refresh token is required.');
  }

  const session = await prisma.refreshSession.findUnique({
    where: {
      tokenHash: hashToken(refreshToken),
    },
  });

  return toPlainObject(session);
}

async function rotateSession({ userId, refreshToken, newRefreshToken }) {
  if (!userId) {
    throw new Error('User id is required.');
  }

  if (!refreshToken) {
    throw new Error('Refresh token is required.');
  }

  if (!newRefreshToken) {
    throw new Error('New refresh token is required.');
  }

  return prisma.$transaction(async (tx) => {
    const currentTokenHash = hashToken(refreshToken);
    const nextTokenHash = hashToken(newRefreshToken);

    const existingSession = await tx.refreshSession.findFirst({
      where: {
        userId,
        tokenHash: currentTokenHash,
      },
    });

    if (!existingSession) {
      throw new Error('Session not found.');
    }

    if (existingSession.revokedAt) {
      throw new Error('Session has been revoked.');
    }

    const session = await tx.refreshSession.update({
      where: {
        id: existingSession.id,
      },
      data: {
        tokenHash: nextTokenHash,
        expiresAt: getSessionExpiryDate(),
      },
    });

    return toPlainObject(session);
  });
}

async function revokeSession(refreshToken) {
  if (!refreshToken) {
    throw new Error('Refresh token is required.');
  }

  const session = await prisma.refreshSession.findUnique({
    where: {
      tokenHash: hashToken(refreshToken),
    },
  });

  if (!session) {
    throw new Error('Session not found.');
  }

  const revokedSession = await prisma.refreshSession.update({
    where: {
      id: session.id,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return toPlainObject(revokedSession);
}

async function revokeAllSessions(userId) {
  if (!userId) {
    throw new Error('User id is required.');
  }

  const sessions = await prisma.refreshSession.findMany({
    where: {
      userId,
    },
  });

  if (sessions.length === 0) {
    return { count: 0 };
  }

  await prisma.refreshSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return { count: sessions.length };
}

module.exports = {
  createSession,
  findSessionByToken,
  rotateSession,
  revokeSession,
  revokeAllSessions,
};
