const knowledgeService = require('../services/knowledge.service');

async function upload(req, res) {
  const document = await knowledgeService.createDocument(req.user.id, req.file);
  return res.status(201).json({ success: true, data: { document } });
}

async function list(req, res) {
  const documents = await knowledgeService.listDocuments(req.user.id);
  return res.status(200).json({ success: true, data: { documents } });
}

async function get(req, res) {
  const document = await knowledgeService.getDocument(req.params.id, req.user.id);
  return res.status(200).json({ success: true, data: { document } });
}

async function remove(req, res) {
  const result = await knowledgeService.deleteDocument(req.params.id, req.user.id);
  return res.status(200).json({ success: true, data: result });
}

async function updateStatus(req, res) {
  const document = await knowledgeService.updateDocumentStatus(
    req.params.id,
    req.user.id,
    req.body.status
  );
  return res.status(200).json({ success: true, data: { document } });
}

module.exports = {
  upload,
  list,
  get,
  remove,
  updateStatus,
};
