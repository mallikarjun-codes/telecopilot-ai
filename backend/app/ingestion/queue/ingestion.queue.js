'use strict';

const IngestionWorker = require('../workers/ingestion.worker');
const logger = require('../utils/logger');

let processor = (documentId) => new IngestionWorker().process(documentId);
const pending = [];
const activeDocumentIds = new Set();
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (pending.length > 0) {
    const documentId = pending.shift();
    try {
      await processor(documentId);
    } catch (error) {
      logger.error('Queued ingestion job failed', { documentId, message: error.message });
    } finally {
      activeDocumentIds.delete(documentId);
    }
  }
  draining = false;
}

function enqueue(documentId) {
  if (activeDocumentIds.has(documentId)) return false;
  activeDocumentIds.add(documentId);
  pending.push(documentId);
  logger.info('Ingestion queued', { documentId });
  setImmediate(drain);
  return true;
}

function setProcessor(nextProcessor) {
  processor = nextProcessor;
}

module.exports = { enqueue, setProcessor };
