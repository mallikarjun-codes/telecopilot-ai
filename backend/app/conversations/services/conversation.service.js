'use strict';

const prisma = require('../../db/prisma');
const env = require('../../config/env');
const logger = require('../../ingestion/utils/logger');
const RagService = require('../../rag/services/rag.service');

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

class ConversationService {
  constructor(options = {}) {
    this.prisma = options.prisma || prisma;
    this.ragService = options.ragService || new RagService();
    this.logger = options.logger || logger;
    this.maxHistoryMessages = options.maxHistoryMessages ?? env.maxHistoryMessages;
    this.autoTitleLength = options.autoTitleLength ?? env.autoTitleLength;
    this.maxConversationMessages = options.maxConversationMessages ?? env.maxConversationMessages;
    this.inputCostPerMillion = options.inputCostPerMillion ?? env.llmInputCostPerMillion;
    this.outputCostPerMillion = options.outputCostPerMillion ?? env.llmOutputCostPerMillion;
  }

  async requireOwned(id, userId, include) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id }, include });
    if (!conversation) throw httpError('Conversation not found.', 404);
    if (conversation.userId !== userId) throw httpError('Forbidden.', 403);
    return conversation;
  }

  async create(userId, input = {}) {
    const conversation = await this.prisma.conversation.create({
      data: { userId, title: input.title || 'New Conversation' },
    });
    this.logger.info('Conversation created', { userId, conversationId: conversation.id });
    return conversation;
  }

  list(userId) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  get(id, userId) {
    return this.requireOwned(id, userId, {
      messages: { orderBy: { createdAt: 'asc' } },
    });
  }

  async remove(id, userId) {
    await this.requireOwned(id, userId);
    await this.prisma.conversation.delete({ where: { id } });
    return { message: 'Conversation deleted successfully.' };
  }

  async updateTitle(id, userId, title) {
    await this.requireOwned(id, userId);
    return this.prisma.conversation.update({ where: { id }, data: { title } });
  }

  async loadHistory(conversationId) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: this.maxHistoryMessages,
      select: { role: true, content: true },
    });
    return messages.reverse();
  }

  buildTitle(question) {
    const normalized = question.replace(/\s+/g, ' ').trim();
    return normalized.slice(0, this.autoTitleLength) || 'New Conversation';
  }

  estimateCost(usage) {
    return ((usage.promptTokens * this.inputCostPerMillion)
      + (usage.completionTokens * this.outputCostPerMillion)) / 1_000_000;
  }

  async recordExchange(id, userId, question, result) {
    const userMessage = await this.beginExchange(id, userId, question);
    const assistantMessage = await this.completeExchange(id, result);
    return { userMessage, assistantMessage };
  }

  async beginExchange(id, userId, question) {
    const conversation = await this.requireOwned(id, userId, { _count: { select: { messages: true } } });
    if (conversation._count.messages + 2 > this.maxConversationMessages) {
      throw httpError('Conversation message limit reached.', 409);
    }
    const userMessage = await this.prisma.message.create({
      data: { conversationId: id, role: 'USER', content: question },
    });
    if (conversation.title === 'New Conversation') {
      await this.prisma.conversation.update({
        where: { id }, data: { title: this.buildTitle(question) },
      });
    }
    return userMessage;
  }

  async completeExchange(id, result) {
    const usage = result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const citations = result.citations || [];
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: id, role: 'ASSISTANT', content: result.answer,
        tokenCount: usage.totalTokens, promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens, totalTokens: usage.totalTokens,
        estimatedCost: this.estimateCost(usage), latency: result.latency, citations,
      },
    });
    await this.prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return assistantMessage;
  }

  async chat(id, userId, question) {
    const totalStartedAt = Date.now();
    const conversation = await this.requireOwned(id, userId, { _count: { select: { messages: true } } });
    if (conversation._count.messages + 2 > this.maxConversationMessages) {
      throw httpError('Conversation message limit reached.', 409);
    }

    this.logger.info('Conversation message received', { userId, conversationId: id });
    const history = await this.loadHistory(id);
    const userMessage = await this.prisma.message.create({
      data: { conversationId: id, role: 'USER', content: question },
    });

    if (conversation.title === 'New Conversation') {
      await this.prisma.conversation.update({
        where: { id },
        data: { title: this.buildTitle(question) },
      });
    }

    const retrievalStartedAt = Date.now();
    const chunks = await this.ragService.retrieve(userId, question);
    this.logger.info('Conversation retrieval complete', {
      userId, conversationId: id, retrievalMs: Date.now() - retrievalStartedAt,
    });

    const llmStartedAt = Date.now();
    const result = await this.ragService.llmService.generateDetailed(
      this.ragService.promptBuilder.build(question, chunks, history)
    );
    const latency = Date.now() - llmStartedAt;
    const citations = chunks.map(({ documentId, originalName, chunkIndex }) => ({
      documentId, originalName, chunkIndex,
    }));
    const usage = result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: id,
        role: 'ASSISTANT',
        content: result.answer,
        tokenCount: usage.totalTokens,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: this.estimateCost(usage),
        latency,
        citations,
      },
    });
    await this.prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    this.logger.info('Conversation answer generated', {
      userId, conversationId: id, llmMs: latency, totalRequestMs: Date.now() - totalStartedAt,
    });
    return { answer: result.answer, citations, usage: { ...usage, estimatedCost: this.estimateCost(usage) }, latency, userMessage, assistantMessage };
  }
}

module.exports = ConversationService;
