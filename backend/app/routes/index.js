'use strict';

const express = require('express');

const authRoutes = require('../auth/routes/auth.routes');
const healthRoutes = require('../health/routes/health.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);

module.exports = router;