'use strict';

const ingestionService = require('../services/ingestion.service');

async function processDocument(req, res) {
  const result = await ingestionService.enqueueForUser(req.params.id, req.user.id);
  return res.status(202).json({ success: true, data: result });
}

module.exports = { processDocument };
