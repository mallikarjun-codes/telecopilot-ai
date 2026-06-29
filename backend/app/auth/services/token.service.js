const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function issueAccessToken(user) {
  const secret = getRequiredEnv('JWT_ACCESS_SECRET');
  const expiresIn = getRequiredEnv('JWT_ACCESS_EXPIRES_IN');

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn,
    }
  );
}

function issueRefreshToken(user) {
  const secret = getRequiredEnv('JWT_REFRESH_SECRET');
  const expiresIn = getRequiredEnv('JWT_REFRESH_EXPIRES_IN');

  return jwt.sign(
    {
      id: user.id,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn,
      jwtid: crypto.randomUUID(),
    }
  );
}

function verifyAccessToken(token) {
  const secret = getRequiredEnv('JWT_ACCESS_SECRET');

  try {
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });
  } catch (error) {
    if (error && error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired.');
    }

    throw new Error('Invalid access token.');
  }
}

function verifyRefreshToken(token) {
  const secret = getRequiredEnv('JWT_REFRESH_SECRET');

  try {
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });
  } catch (error) {
    if (error && error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired.');
    }

    throw new Error('Invalid refresh token.');
  }
}

function getTokenExpiry(token) {
  const payload = jwt.decode(token);

  if (!payload || typeof payload.exp !== 'number') {
    throw new Error('Token expiry is missing.');
  }

  return new Date(payload.exp * 1000);
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpiry,
};
