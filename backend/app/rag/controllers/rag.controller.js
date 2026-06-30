'use strict';

const RagService = require('../services/rag.service');

const ragService = new RagService();

async function chat(req, res) {
  const data = await ragService.answer(req.user.id, req.body.question);
  return res.status(200).json({ success: true, data });
}

async function search(req, res) {
  const chunks = await ragService.retrieve(req.user.id, req.query.q);
  return res.status(200).json({ success: true, data: { chunks } });
}

module.exports = { chat, search };
