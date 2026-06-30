'use strict';

const prisma = require('../../db/prisma');
const ingestionQueue = require('../queue/ingestion.queue');

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function enqueueForUser(documentId, userId) {
  const document = await prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
  if (!document) throw httpError('Document not found.', 404);
  if (document.userId !== userId) throw httpError('Forbidden.', 403);

  const queued = ingestionQueue.enqueue(documentId);
  return { documentId, queued };
}

module.exports = { enqueueForUser };
