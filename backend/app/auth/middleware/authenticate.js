const { verifyAccessToken } = require('../services/token.service');

function authenticate(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (typeof authorizationHeader !== 'string' || authorizationHeader.trim().length === 0) {
    const error = new Error('Unauthorized.');
    error.statusCode = 401;
    return next(error);
  }

  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    const error = new Error('Unauthorized.');
    error.statusCode = 401;
    return next(error);
  }

  const accessToken = bearerMatch[1].trim();

  if (!accessToken) {
    const error = new Error('Unauthorized.');
    error.statusCode = 401;
    return next(error);
  }

  try {
    const user = verifyAccessToken(accessToken);

    req.user = user;
    return next();
  } catch (error) {
    const unauthorizedError = new Error('Unauthorized.');
    unauthorizedError.statusCode = 401;
    return next(unauthorizedError);
  }
}

module.exports = authenticate;
