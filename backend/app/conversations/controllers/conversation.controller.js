'use strict';

const ConversationService = require('../services/conversation.service');

const service = new ConversationService();

async function create(req, res) {
  const conversation = await service.create(req.user.id, req.body);
  return res.status(201).json({ success: true, data: { conversation } });
}

async function list(req, res) {
  const conversations = await service.list(req.user.id);
  return res.status(200).json({ success: true, data: { conversations } });
}

async function get(req, res) {
  const conversation = await service.get(req.params.id, req.user.id);
  return res.status(200).json({ success: true, data: { conversation } });
}

async function remove(req, res) {
  const result = await service.remove(req.params.id, req.user.id);
  return res.status(200).json({ success: true, data: result });
}

async function updateTitle(req, res) {
  const conversation = await service.updateTitle(req.params.id, req.user.id, req.body.title);
  return res.status(200).json({ success: true, data: { conversation } });
}

async function chat(req, res) {
  const result = await service.chat(req.params.id, req.user.id, req.body.question);
  return res.status(200).json({ success: true, data: result });
}

module.exports = { create, list, get, updateTitle, remove, chat };
