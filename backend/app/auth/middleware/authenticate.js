const { verifyAccessToken } = require('../services/token.service');

function authenticate(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (typeof authorizationHeader !== 'string' || authorizationHeader.trim().length === 0) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const accessToken = bearerMatch[1].trim();

  if (!accessToken) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const user = verifyAccessToken(accessToken);

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
}

module.exports = authenticate;
