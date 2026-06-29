'use strict';

const healthService = require('../services/health.service');

async function live(req, res, next) {
  try {
    const result = await healthService.live();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function ready(req, res, next) {
  try {
    const result = await healthService.ready();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  live,
  ready,
};