'use strict';

const Joi = require('joi');
const env = require('../../config/env');

const title = Joi.string().trim().min(1).max(env.autoTitleLength);

module.exports = {
  idSchema: Joi.object({ id: Joi.string().trim().min(1).max(191).required() }).required(),
  createSchema: Joi.object({ title: title.optional() }).required(),
  updateTitleSchema: Joi.object({ title: title.required() }).required(),
  chatSchema: Joi.object({
    question: Joi.string().trim().min(3).max(2000).required(),
  }).required(),
};
