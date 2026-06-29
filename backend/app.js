'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./app/config/env');
const routes = require('./app/routes');
const notFound = require('./app/middleware/notFound');
const errorHandler = require('./app/middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Telecopilot API is running',
    health: '/api/v1/health/live',
  });
});

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

console.log('app.js loaded routes');
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
