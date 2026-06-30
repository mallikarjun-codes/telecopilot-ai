'use strict';

const path = require('path');
const prisma = require('../../db/prisma');
const EmbeddingService = require('../services/embedding.service');
const { extractPdfText } = require('../services/pdf-extraction.service');
const { chunkText } = require('../services/chunking.service');
const { replaceDocumentChunks } = require('../services/chunk.repository');
const logger = require('../utils/logger');

const backendDirectory = path.resolve(__dirname, '../../..');

class IngestionWorker {
  constructor(dependencies = {}) {
    this.prisma = dependencies.prisma || prisma;
    this.embeddingService = dependencies.embeddingService || new EmbeddingService();
    this.extractPdfText = dependencies.extractPdfText || extractPdfText;
    this.chunkText = dependencies.chunkText || chunkText;
    this.replaceDocumentChunks = dependencies.replaceDocumentChunks || replaceDocumentChunks;
    this.logger = dependencies.logger || logger;
  }

  async process(documentId) {
    this.logger.info('Ingestion processing started', { documentId });
    try {
      const document = await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });
      const filePath = path.resolve(backendDirectory, document.storagePath);
      const extraction = await this.extractPdfText(filePath);
      this.logger.info('PDF extraction finished', { documentId, pageCount: extraction.pageCount });

      const chunks = this.chunkText(extraction.text);
      if (chunks.length === 0) throw new Error('PDF contains no extractable text.');
      this.logger.info('Document chunking finished', { documentId, chunkCount: chunks.length });

      const embeddedChunks = [];
      for (const chunk of chunks) {
        const embedding = await this.embeddingService.generateEmbedding(chunk.content);
        embeddedChunks.push({
          ...chunk,
          embedding,
          metadata: { pageCount: extraction.pageCount, source: document.originalName },
        });
        this.logger.info('Embedding progress', {
          documentId,
          completed: embeddedChunks.length,
          total: chunks.length,
        });
      }

      await this.replaceDocumentChunks(documentId, embeddedChunks, this.prisma);
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'READY' },
      });
      this.logger.info('Ingestion completed', { documentId, chunkCount: chunks.length });
    } catch (error) {
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      }).catch(() => {});
      this.logger.error('Ingestion failed', { documentId, message: error.message });
      throw error;
    }
  }
}

module.exports = IngestionWorker;
