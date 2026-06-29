'use strict';

console.log('✅ Root router loaded');

const express = require('express');

const authRoutes = require('../auth/routes/auth.routes');
const healthRoutes = require('../health/routes/health.routes');

const router = express.Router();

console.log('✅ Mounting auth routes');
router.use('/auth', authRoutes);

console.log('✅ Mounting health routes');
router.use('/health', healthRoutes);

module.exports = router;