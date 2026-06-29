'use strict';

const dotenv = require('dotenv');

dotenv.config();

const defaults = {
  PORT: '5000',
  NODE_ENV: 'development',
};

const requiredKeys = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
];

const missing = requiredKeys.filter((key) => {
  if (key === 'PORT' || key === 'NODE_ENV') {
    return !process.env[key] && !defaults[key];
  }

  return !process.env[key] || process.env[key].trim() === '';
});

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}.`
  );
}

const config = Object.freeze({
  port: Number.parseInt(process.env.PORT || defaults.PORT, 10),
  nodeEnv: process.env.NODE_ENV || defaults.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
});

module.exports = config;
