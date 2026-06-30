'use strict';

module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  if (err.details) {
    response.errors = err.details;
  }

  return res.status(statusCode).json(response);
};
