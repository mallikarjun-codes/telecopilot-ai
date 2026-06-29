const authService = require('../services/auth.service');

async function register(req, res, next) {
  const result = await authService.register(req.body);
  return res.status(201).json({ success: true, data: result });
}

async function login(req, res, next) {
  const result = await authService.login(req.body);
  return res.status(200).json({ success: true, data: result });
}

async function refresh(req, res, next) {
  const result = await authService.refresh(req.body.refreshToken);
  return res.status(200).json({ success: true, data: result });
}

async function logout(req, res, next) {
  const result = await authService.logout({
    refreshToken: req.body.refreshToken,
    userId: req.user.id,
  });
  return res.status(200).json({ success: true, data: result });
}

async function me(req, res, next) {
  const result = await authService.me(req.user);
  return res.status(200).json({ success: true, data: result });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
