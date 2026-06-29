const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} = require('../validators/auth.validator');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, validate(logoutSchema), authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
