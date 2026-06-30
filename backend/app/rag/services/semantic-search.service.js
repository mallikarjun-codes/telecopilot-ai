'use strict';

const { Prisma } = require('@prisma/client');
const prisma = require('../../db/prisma');
const env = require('../../config/env');
const { toVectorLiteral } = require('../utils/vector');

class SemanticSearchService {
  constructor(options = {}) {
    this.prisma = options.prisma || prisma;
    this.topK = options.topK ?? env.ragTopK;
    this.threshold = options.threshold ?? env.ragSimilarityThreshold;
  }

  async search(userId, embedding, options = {}) {
    const topK = options.topK ?? this.topK;
    const threshold = options.threshold ?? this.threshold;
    if (!Number.isInteger(topK) || topK < 1 || topK > 50) throw new Error('RAG_TOP_K must be between 1 and 50.');
    if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new Error('RAG_SIMILARITY_THRESHOLD must be between -1 and 1.');
    const vector = toVectorLiteral(embedding);

    return this.prisma.$queryRaw(Prisma.sql`
      SELECT
        chunk."id", chunk."documentId", chunk."chunkIndex", chunk."content", chunk."metadata",
        document."originalName",
        (1 - (chunk."embedding" <=> ${vector}::vector))::double precision AS "similarity"
      FROM "DocumentChunk" AS chunk
      INNER JOIN "KnowledgeDocument" AS document ON document."id" = chunk."documentId"
      WHERE document."userId" = ${userId}
        AND document."status" = 'READY'
        AND (1 - (chunk."embedding" <=> ${vector}::vector)) >= ${threshold}
      ORDER BY chunk."embedding" <=> ${vector}::vector ASC
      LIMIT ${topK}
    `);
  }
}

module.exports = SemanticSearchService;
