'use strict';

const Joi = require('joi');

const question = Joi.string().trim().min(3).max(2000).required();

module.exports = {
  chatSchema: Joi.object({ question }).required(),
  searchSchema: Joi.object({ q: question }).required(),
};
