'use strict';

const express = require('express');
const authenticate = require('../../auth/middleware/authenticate');
const { validate } = require('../../knowledge/middleware/validate');
const controller = require('../controllers/rag.controller');
const { chatSchema, searchSchema } = require('../validators/rag.validator');

const router = express.Router();
router.use(authenticate);
router.post('/', validate('body', chatSchema), controller.chat);
router.get('/search', validate('query', searchSchema), controller.search);

module.exports = router;
