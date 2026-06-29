const bcrypt = require('bcrypt');
const tokenService = require('./token.service');
const sessionService = require('./session.service');
const prisma = require('../../db/prisma');

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...rest } = user;
  return rest;
}

async function register(userData) {
  const { name, email, password, role = 'USER' } = userData || {};

  if (!name || !email || !password) {
    throw createHttpError('Name, email, and password are required.', 400);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw createHttpError('A valid email address is required.', 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw createHttpError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    },
  });

  const accessToken = tokenService.issueAccessToken(user);
  const refreshToken = tokenService.issueRefreshToken(user);
  await sessionService.createSession({ userId: user.id, refreshToken });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
  };
}

async function login(credentials) {
  const { email, password } = credentials || {};

  if (!email || !password) {
    throw createHttpError('Email and password are required.', 400);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !user.isActive) {
    throw createHttpError('Invalid credentials.', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw createHttpError('Invalid credentials.', 401);
  }

  const accessToken = tokenService.issueAccessToken(user);
  const refreshToken = tokenService.issueRefreshToken(user);
  await sessionService.createSession({ userId: user.id, refreshToken });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    throw createHttpError('Refresh token is required.', 400);
  }

  const payload = tokenService.verifyRefreshToken(refreshToken);
  const userId = payload.userId || payload.sub || payload.id;

  if (!userId) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  const session = await sessionService.findSessionByToken(refreshToken);
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  const newRefreshToken = tokenService.issueRefreshToken(user);
  await sessionService.rotateSession({
    userId: user.id,
    refreshToken,
    newRefreshToken,
  });

  return {
    user: sanitizeUser(user),
    accessToken: tokenService.issueAccessToken(user),
    refreshToken: newRefreshToken,
    tokenType: 'Bearer',
  };
}

async function logout(logoutData) {
  const { refreshToken, userId, revokeAll } = logoutData || {};

  if (revokeAll && userId) {
    await sessionService.revokeAllSessions(userId);
    return { success: true };
  }

  if (!refreshToken && !userId) {
    throw createHttpError('Refresh token or user id is required.', 400);
  }

  if (refreshToken) {
    await sessionService.revokeSession(refreshToken);
  } else if (userId) {
    await sessionService.revokeAllSessions(userId);
  }

  return { success: true };
}

async function me(user) {
  if (!user || !user.id) {
    throw createHttpError('Authentication is required.', 401);
  }

  const currentUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!currentUser || !currentUser.isActive) {
    throw createHttpError('User not found.', 404);
  }

  return sanitizeUser(currentUser);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
