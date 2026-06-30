'use strict';

const express = require('express');
const authenticate = require('../../auth/middleware/authenticate');
const { validate } = require('../../knowledge/middleware/validate');
const controller = require('../controllers/agent.controller');
const { chatSchema } = require('../validators/agent.validator');

const router = express.Router();
router.use(authenticate);
router.post('/chat', validate('body', chatSchema), controller.chat);
router.post('/chat/stream', validate('body', chatSchema), controller.stream);

module.exports = router;
