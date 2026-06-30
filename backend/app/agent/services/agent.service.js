'use strict';

const env = require('../../config/env');
const logger = require('../../ingestion/utils/logger');
const LLMService = require('../../rag/services/llm.service');
const ConversationService = require('../../conversations/services/conversation.service');
const IntentClassifier = require('./intent-classifier.service');
const AgentPromptBuilder = require('./prompt-builder.service');
const ToolRegistry = require('./tool-registry.service');
const KnowledgeSearchTool = require('./knowledge-search.tool');

const { INTENTS } = IntentClassifier;

class AgentService {
  constructor(options = {}) {
    this.classifier = options.classifier || new IntentClassifier();
    this.promptBuilder = options.promptBuilder || new AgentPromptBuilder();
    this.llmService = options.llmService || new LLMService();
    this.conversationService = options.conversationService || new ConversationService();
    this.logger = options.logger || logger;
    this.maxHistory = options.maxHistory ?? env.agentMaxHistory;
    this.maxContextChunks = options.maxContextChunks ?? env.agentMaxContextChunks;
    this.minConfidence = options.minConfidence ?? env.agentMinConfidence;
    this.registry = options.registry || new ToolRegistry([
      new KnowledgeSearchTool({ ragService: options.ragService }),
    ]);
    if (!Number.isInteger(this.maxHistory) || this.maxHistory < 0 || this.maxHistory > 100) {
      throw new Error('AGENT_MAX_HISTORY must be between 0 and 100.');
    }
    if (!Number.isInteger(this.maxContextChunks) || this.maxContextChunks < 1 || this.maxContextChunks > 50) {
      throw new Error('AGENT_MAX_CONTEXT_CHUNKS must be between 1 and 50.');
    }
    if (!Number.isFinite(this.minConfidence) || this.minConfidence < 0 || this.minConfidence > 1) {
      throw new Error('AGENT_MIN_CONFIDENCE must be between 0 and 1.');
    }
  }

  citationsFor(chunks) {
    return chunks.map(({ documentId, originalName, chunkIndex }) => ({
      documentId, originalName, chunkIndex,
    }));
  }

  followUpQuery(message, history) {
    const previousQuestion = [...history].reverse().find(({ role }) => String(role).toUpperCase() === 'USER');
    return previousQuestion ? `${previousQuestion.content}\nFollow-up: ${message}` : message;
  }

  async chat(userId, input) {
    try {
      return await this.run(userId, input);
    } catch (error) {
      this.logger.error('Agent error', {
        userId, conversationId: input.conversationId || null, error: error.message,
      });
      throw error;
    }
  }

  async run(userId, input) {
    const startedAt = Date.now();
    const prepared = await this.prepare(userId, input);
    const { conversation, chunks, classification, shouldRetrieve, messages } = prepared;
    const llmStartedAt = Date.now();
    const result = await this.llmService.generateDetailed(messages);
    const llmLatency = Date.now() - llmStartedAt;
    const latency = Date.now() - startedAt;
    const citations = this.citationsFor(chunks);
    const usage = result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    await this.conversationService.recordExchange(conversation.id, userId, input.message, {
      answer: result.answer, citations, usage, latency: llmLatency,
    });
    const usageWithCost = { ...usage, estimatedCost: this.conversationService.estimateCost(usage) };
    const action = shouldRetrieve ? 'RAG' : 'DIRECT';
    this.logger.info('Agent answer generated', {
      userId, conversationId: conversation.id, action, llmMs: llmLatency, latency,
    });
    return {
      conversationId: conversation.id, answer: result.answer, citations,
      usage: usageWithCost, latency,
      agent: { action, retrievedChunks: chunks.length, confidence: classification.confidence, latency },
    };
  }

  async prepare(userId, input) {
    let conversation;
    this.logger.info('Agent start', { userId, conversationId: input.conversationId || null });
    if (input.conversationId) {
      conversation = await this.conversationService.requireOwned(input.conversationId, userId);
    } else {
      conversation = await this.conversationService.create(userId);
    }

    const allHistory = await this.conversationService.loadHistory(conversation.id);
    const history = this.maxHistory === 0 ? [] : allHistory.slice(-this.maxHistory);
    const classification = this.classifier.classify(input.message, {
      hasConversation: Boolean(input.conversationId && history.length),
    });
    this.logger.info('Agent intent classified', {
      userId, conversationId: conversation.id, intent: classification.intent,
      confidence: classification.confidence,
    });

    let chunks = [];
    const shouldRetrieve = classification.confidence >= this.minConfidence
      && [INTENTS.KNOWLEDGE_SEARCH, INTENTS.FOLLOW_UP].includes(classification.intent);
    if (shouldRetrieve) {
      const query = classification.intent === INTENTS.FOLLOW_UP
        ? this.followUpQuery(input.message, history) : input.message;
      chunks = (await this.registry.execute('knowledge_search', { userId, query }))
        .slice(0, this.maxContextChunks);
    }
    this.logger.info('Agent retrieval complete', {
      userId, conversationId: conversation.id, retrievedChunks: chunks.length,
    });

    const messages = this.promptBuilder.build({
      question: input.message, history, chunks, intent: classification.intent,
    });
    return { conversation, chunks, classification, shouldRetrieve, messages };
  }
}

module.exports = AgentService;
