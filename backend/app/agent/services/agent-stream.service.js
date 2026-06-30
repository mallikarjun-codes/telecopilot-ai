'use strict';

const AgentService = require('./agent.service');

class AgentStreamService {
  constructor(options = {}) {
    this.agent = options.agent || new AgentService(options);
    this.logger = options.logger || this.agent.logger;
  }

  async stream(userId, input, emit, signal) {
    const startedAt = Date.now();
    let conversationId = input.conversationId || null;
    let tokensStreamed = 0;
    const abortSignal = signal || new AbortController().signal;
    try {
      const prepared = await this.agent.prepare(userId, input);
      conversationId = prepared.conversation.id;
      const citations = this.agent.citationsFor(prepared.chunks);
      const action = prepared.shouldRetrieve ? 'RAG' : 'DIRECT';
      await this.agent.conversationService.beginExchange(conversationId, userId, input.message);
      emit('start', { conversationId });
      this.logger.info('Agent stream started', { userId, conversationId });

      let answer = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      const source = typeof this.agent.llmService.streamDetailed === 'function'
        ? this.agent.llmService.streamDetailed(prepared.messages, { signal: abortSignal }) : null;
      if (source) {
        for await (const part of source) {
          if (abortSignal.aborted) throw Object.assign(new Error('Stream cancelled.'), { name: 'AbortError' });
          if (part.token) { answer += part.token; tokensStreamed += 1; emit('token', part.token); }
          if (part.usage) usage = part.usage;
        }
      } else {
        const result = await this.agent.llmService.generateDetailed(prepared.messages);
        usage = result.usage || usage;
        for (const token of result.answer.match(/\s+|\S+/g) || []) {
          if (abortSignal.aborted) throw Object.assign(new Error('Stream cancelled.'), { name: 'AbortError' });
          answer += token; tokensStreamed += 1; emit('token', token);
        }
      }
      if (!answer.trim()) throw new Error('LLM provider returned an invalid answer.');
      citations.forEach((citation) => emit('citation', citation));
      const latency = Date.now() - startedAt;
      const usageWithCost = { ...usage, estimatedCost: this.agent.conversationService.estimateCost(usage) };
      await this.agent.conversationService.completeExchange(conversationId, { answer: answer.trim(), citations, usage, latency });
      emit('metadata', { latency, usage: usageWithCost, agent: { action, retrievedChunks: prepared.chunks.length, confidence: prepared.classification.confidence } });
      emit('done', { conversationId });
      this.logger.info('Agent stream completed', { userId, conversationId, tokensStreamed, latency });
    } catch (error) {
      const latency = Date.now() - startedAt;
      if (abortSignal.aborted || error.name === 'AbortError') {
        this.logger.info('Agent stream cancelled', { userId, conversationId, tokensStreamed, latency });
        return;
      }
      this.logger.error('Agent stream error', { userId, conversationId, tokensStreamed, latency, error: error.message });
      emit('error', { message: error.message || 'Streaming failed.' });
    }
  }
}

module.exports = AgentStreamService;
