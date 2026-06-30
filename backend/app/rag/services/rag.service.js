'use strict';

const EmbeddingService = require('../../ingestion/services/embedding.service');
const logger = require('../../ingestion/utils/logger');
const SemanticSearchService = require('./semantic-search.service');
const PromptBuilder = require('./prompt-builder.service');
const LLMService = require('./llm.service');

class RagService {
  constructor(options = {}) {
    this.embeddingService = options.embeddingService || new EmbeddingService();
    this.searchService = options.searchService || new SemanticSearchService();
    this.promptBuilder = options.promptBuilder || new PromptBuilder();
    this.llmService = options.llmService || new LLMService();
    this.logger = options.logger || logger;
  }

  async retrieve(userId, question) {
    const startedAt = Date.now();
    this.logger.info('RAG question received', { userId });
    const embedding = await this.embeddingService.generateEmbedding(question);
    this.logger.info('RAG embedding generated', { userId });
    const chunks = await this.searchService.search(userId, embedding);
    this.logger.info('RAG retrieval complete', {
      userId,
      chunkCount: chunks.length,
      retrievalMs: Date.now() - startedAt,
    });
    return chunks;
  }

  async answer(userId, question) {
    const startedAt = Date.now();
    const chunks = await this.retrieve(userId, question);
    const llmStartedAt = Date.now();
    const answer = await this.llmService.generate(this.promptBuilder.build(question, chunks));
    const citations = chunks.map(({ documentId, originalName, chunkIndex }) => ({
      documentId,
      originalName,
      chunkIndex,
    }));
    this.logger.info('RAG answer generated', {
      userId,
      llmMs: Date.now() - llmStartedAt,
      totalLatencyMs: Date.now() - startedAt,
    });
    return { answer, citations };
  }
}

module.exports = RagService;
