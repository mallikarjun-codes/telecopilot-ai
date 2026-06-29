const bcrypt = require('bcrypt');
const tokenService = require('./token.service');
const sessionService = require('./session.service');
const prisma = require('../../db/prisma');

const PASSWORD_HASH_ROUNDS = 12;

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function createTokenPair(user) {
  const accessToken = tokenService.issueAccessToken(user);
  const refreshToken = tokenService.issueRefreshToken(user);

  await sessionService.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: tokenService.getTokenExpiry(refreshToken),
  });

  return { accessToken, refreshToken, tokenType: 'Bearer' };
}

async function register({ name, email, password }) {
  const normalizedEmail = email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw createHttpError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  let user;

  try {
    user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError('An account with this email already exists.', 409);
    }

    throw error;
  }

  return {
    user: toPublicUser(user),
    ...(await createTokenPair(user)),
  };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !user.isActive || !passwordMatches) {
    throw createHttpError('Invalid credentials.', 401);
  }

  return {
    user: toPublicUser(user),
    ...(await createTokenPair(user)),
  };
}

async function refresh(refreshToken) {
  let payload;

  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch (error) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.isActive) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  const session = await sessionService.findSessionByToken({
    userId: user.id,
    refreshToken,
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  const newRefreshToken = tokenService.issueRefreshToken(user);
  const rotatedSession = await sessionService.rotateSession({
    userId: user.id,
    refreshToken,
    newRefreshToken,
    newExpiresAt: tokenService.getTokenExpiry(newRefreshToken),
  });

  if (!rotatedSession) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  return {
    accessToken: tokenService.issueAccessToken(user),
    refreshToken: newRefreshToken,
    tokenType: 'Bearer',
  };
}

async function logout({ userId, refreshToken }) {
  let payload;

  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch (error) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  if (payload.id !== userId) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  const revokedSession = await sessionService.revokeSession({
    userId,
    refreshToken,
  });

  if (!revokedSession) {
    throw createHttpError('Invalid refresh token.', 401);
  }

  return { message: 'Logged out successfully.' };
}

async function me(authenticatedUser) {
  const user = await prisma.user.findUnique({
    where: { id: authenticatedUser.id },
  });

  if (!user || !user.isActive) {
    throw createHttpError('User not found.', 404);
  }

  return toPublicUser(user);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
