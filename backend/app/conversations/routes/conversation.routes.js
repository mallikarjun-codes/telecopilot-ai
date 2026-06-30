'use strict';

const express = require('express');
const authenticate = require('../../auth/middleware/authenticate');
const { validate } = require('../../knowledge/middleware/validate');
const controller = require('../controllers/conversation.controller');
const schemas = require('../validators/conversation.validator');

const router = express.Router();
router.use(authenticate);
router.post('/', validate('body', schemas.createSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', validate('params', schemas.idSchema), controller.get);
router.patch('/:id', validate('params', schemas.idSchema), validate('body', schemas.updateTitleSchema), controller.updateTitle);
router.delete('/:id', validate('params', schemas.idSchema), controller.remove);
router.post('/:id/chat', validate('params', schemas.idSchema), validate('body', schemas.chatSchema), controller.chat);

module.exports = router;
