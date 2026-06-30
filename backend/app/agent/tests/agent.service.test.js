'use strict';

const AgentService = require('../services/agent.service');

function dependencies(intent) {
  const conversationService = {
    create: jest.fn(async () => ({ id: 'conversation-1' })),
    requireOwned: jest.fn(async () => ({ id: 'conversation-1' })),
    loadHistory: jest.fn(async () => []),
    recordExchange: jest.fn(async () => ({})),
    estimateCost: jest.fn(() => 0),
  };
  return {
    classifier: { classify: jest.fn(() => ({ intent, confidence: 0.9 })) },
    promptBuilder: { build: jest.fn(() => [{ role: 'user', content: 'prompt' }]) },
    llmService: { generateDetailed: jest.fn(async () => ({ answer: 'Answer', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } })) },
    conversationService,
    registry: { execute: jest.fn(async () => [{ documentId: 'd1', originalName: 'doc.pdf', chunkIndex: 0, content: 'context' }]) },
    logger: { info: jest.fn(), error: jest.fn() },
    maxHistory: 20, maxContextChunks: 5, minConfidence: 0.7,
  };
}

describe('AgentService', () => {
  it('answers greetings without retrieval and saves the exchange', async () => {
    const options = dependencies('GREETING');
    const result = await new AgentService(options).chat('u1', { message: 'hello' });
    expect(options.registry.execute).not.toHaveBeenCalled();
    expect(result.agent.action).toBe('DIRECT');
    expect(result.conversationId).toBe('conversation-1');
    expect(options.conversationService.recordExchange).toHaveBeenCalled();
  });

  it('uses the knowledge tool and returns citations for knowledge questions', async () => {
    const options = dependencies('KNOWLEDGE_SEARCH');
    const result = await new AgentService(options).chat('u1', { conversationId: 'conversation-1', message: 'our policy?' });
    expect(options.conversationService.requireOwned).toHaveBeenCalledWith('conversation-1', 'u1');
    expect(options.registry.execute).toHaveBeenCalledWith('knowledge_search', { userId: 'u1', query: 'our policy?' });
    expect(result.agent).toMatchObject({ action: 'RAG', retrievedChunks: 1, confidence: 0.9 });
    expect(result.citations).toEqual([{ documentId: 'd1', originalName: 'doc.pdf', chunkIndex: 0 }]);
  });

  it('handles an empty knowledge result without inventing citations', async () => {
    const options = dependencies('KNOWLEDGE_SEARCH');
    options.registry.execute.mockResolvedValue([]);
    const result = await new AgentService(options).chat('u1', { message: 'our policy?' });
    expect(result.citations).toEqual([]);
    expect(result.agent.retrievedChunks).toBe(0);
  });
});
