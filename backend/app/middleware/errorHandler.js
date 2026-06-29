'use strict';

const env = require('../config/env');

module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  if (env.nodeEnv === 'development') {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};