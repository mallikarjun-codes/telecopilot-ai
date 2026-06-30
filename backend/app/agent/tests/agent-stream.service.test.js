'use strict';

const AgentStreamService = require('../services/agent-stream.service');

function setup() {
  const conversationService = {
    beginExchange: jest.fn(async () => ({})), completeExchange: jest.fn(async () => ({})),
    estimateCost: jest.fn(() => 0),
  };
  const agent = {
    logger: { info: jest.fn(), error: jest.fn() }, conversationService,
    citationsFor: jest.fn(() => [{ documentId: 'd1', originalName: 'doc.pdf', chunkIndex: 0 }]),
    prepare: jest.fn(async () => ({
      conversation: { id: 'c1' }, chunks: [{}], classification: { confidence: 0.9 },
      shouldRetrieve: true, messages: [{ role: 'user', content: 'hello' }],
    })),
    llmService: { streamDetailed: jest.fn(async function* stream() {
      yield { token: 'Hello' }; yield { token: ' world' };
      yield { usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } };
    }) },
  };
  return { agent, conversationService, service: new AgentStreamService({ agent }), emit: jest.fn() };
}

describe('AgentStreamService', () => {
  it('streams tokens, citations and metadata, then saves the assistant', async () => {
    const { service, emit, conversationService } = setup();
    await service.stream('u1', { message: 'hello' }, emit, new AbortController().signal);
    expect(conversationService.beginExchange.mock.invocationCallOrder[0])
      .toBeLessThan(conversationService.completeExchange.mock.invocationCallOrder[0]);
    expect(emit.mock.calls.map(([event]) => event)).toEqual(['start', 'token', 'token', 'citation', 'metadata', 'done']);
    expect(conversationService.completeExchange).toHaveBeenCalledWith('c1', expect.objectContaining({ answer: 'Hello world' }));
  });

  it('does not save an assistant response after cancellation', async () => {
    const { service, emit, agent, conversationService } = setup();
    const controller = new AbortController();
    agent.llmService.streamDetailed = async function* stream() { controller.abort(); yield { token: 'late' }; };
    await service.stream('u1', { message: 'hello' }, emit, controller.signal);
    expect(conversationService.beginExchange).toHaveBeenCalled();
    expect(conversationService.completeExchange).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('start', { conversationId: 'c1' });
  });

  it('emits an error and closes cleanly when generation fails', async () => {
    const { service, emit, agent, conversationService } = setup();
    agent.llmService.streamDetailed = async function* stream() { throw new Error('provider failed'); };
    await service.stream('u1', { message: 'hello' }, emit, new AbortController().signal);
    expect(emit).toHaveBeenLastCalledWith('error', { message: 'provider failed' });
    expect(conversationService.completeExchange).not.toHaveBeenCalled();
  });
});
