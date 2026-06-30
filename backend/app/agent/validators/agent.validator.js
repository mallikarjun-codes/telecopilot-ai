'use strict';

const Joi = require('joi');

const chatSchema = Joi.object({
  conversationId: Joi.string().trim().min(1).max(191).optional(),
  message: Joi.string().trim().min(1).max(2000).required(),
}).required().unknown(false);

module.exports = { chatSchema };
