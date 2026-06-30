'use strict';

const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../../db/prisma');

async function replaceDocumentChunks(documentId, chunks, client = prisma) {
  await client.$transaction(async (transaction) => {
    await transaction.documentChunk.deleteMany({ where: { documentId } });
    for (const chunk of chunks) {
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "DocumentChunk"
          ("id", "documentId", "chunkIndex", "content", "embedding", "metadata", "createdAt")
        VALUES
          (${crypto.randomUUID()}, ${documentId}, ${chunk.index}, ${chunk.content},
           ${JSON.stringify(chunk.embedding)}::vector, ${JSON.stringify(chunk.metadata)}::jsonb, NOW())
      `);
    }
  });
}

module.exports = { replaceDocumentChunks };
