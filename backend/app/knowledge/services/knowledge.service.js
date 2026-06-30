const fs = require('fs/promises');
const path = require('path');
const prisma = require('../../db/prisma');
const ingestionQueue = require('../../ingestion/queue/ingestion.queue');

const backendDirectory = path.resolve(__dirname, '../../..');

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toDocumentResponse(document) {
  return {
    id: document.id,
    filename: document.filename,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function findDocumentWithOwnership(id, userId) {
  const document = await prisma.knowledgeDocument.findUnique({ where: { id } });

  if (!document) {
    throw createHttpError('Document not found.', 404);
  }

  if (document.userId !== userId) {
    throw createHttpError('Forbidden.', 403);
  }

  return document;
}

async function createDocument(userId, file) {
  const storagePath = path
    .relative(backendDirectory, file.path)
    .split(path.sep)
    .join('/');

  try {
    const document = await prisma.knowledgeDocument.create({
      data: {
        userId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath,
      },
    });

    ingestionQueue.enqueue(document.id);

    return toDocumentResponse(document);
  } catch (error) {
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }
}

async function listDocuments(userId) {
  const documents = await prisma.knowledgeDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      originalName: true,
      status: true,
      createdAt: true,
    },
  });

  return documents;
}

async function getDocument(id, userId) {
  const document = await findDocumentWithOwnership(id, userId);
  return toDocumentResponse(document);
}

async function deleteDocument(id, userId) {
  const document = await findDocumentWithOwnership(id, userId);

  await prisma.knowledgeDocument.delete({ where: { id: document.id } });

  const absoluteStoragePath = path.resolve(backendDirectory, document.storagePath);
  await fs.unlink(absoluteStoragePath).catch((error) => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  });

  return { message: 'Document deleted successfully.' };
}

async function updateDocumentStatus(id, userId, status) {
  const document = await findDocumentWithOwnership(id, userId);
  const updatedDocument = await prisma.knowledgeDocument.update({
    where: { id: document.id },
    data: { status },
  });

  return toDocumentResponse(updatedDocument);
}

module.exports = {
  createDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  updateDocumentStatus,
};
