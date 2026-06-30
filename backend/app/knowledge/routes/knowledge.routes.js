const express = require('express');
const authenticate = require('../../auth/middleware/authenticate');
const knowledgeController = require('../controllers/knowledge.controller');
const ingestionController = require('../../ingestion/controllers/ingestion.controller');
const uploadPdf = require('../middleware/upload');
const { validate, validateFile } = require('../middleware/validate');
const {
  documentIdSchema,
  statusSchema,
  uploadFileSchema,
} = require('../validators/knowledge.validator');

const router = express.Router();

router.use(authenticate);

router.post('/upload', uploadPdf, validateFile(uploadFileSchema), knowledgeController.upload);
router.get('/', knowledgeController.list);
router.get('/:id', validate('params', documentIdSchema), knowledgeController.get);
router.delete('/:id', validate('params', documentIdSchema), knowledgeController.remove);
router.post(
  '/:id/process',
  validate('params', documentIdSchema),
  ingestionController.processDocument
);
router.patch(
  '/:id/status',
  validate('params', documentIdSchema),
  validate('body', statusSchema),
  knowledgeController.updateStatus
);

module.exports = router;
