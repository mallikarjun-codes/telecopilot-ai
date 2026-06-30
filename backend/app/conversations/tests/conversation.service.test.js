'use strict';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-sufficient-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const ConversationService = require('../services/conversation.service');

function setup(overrides = {}) {
  const prisma = {
    conversation: {
      create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
      delete: jest.fn(), update: jest.fn(),
    },
    message: { findMany: jest.fn(), create: jest.fn() },
  };
  const ragService = {
    retrieve: jest.fn(),
    promptBuilder: { build: jest.fn().mockReturnValue([{ role: 'system', content: 'prompt' }]) },
    llmService: { generateDetailed: jest.fn() },
  };
  const logger = { info: jest.fn() };
  return {
    prisma, ragService, logger,
    service: new ConversationService({ prisma, ragService, logger, ...overrides }),
  };
}

describe('ConversationService', () => {
  it('creates a conversation owned by the authenticated user', async () => {
    const { service, prisma, logger } = setup();
    prisma.conversation.create.mockResolvedValue({ id: 'c1', userId: 'u1', title: 'New Conversation' });
    await expect(service.create('u1')).resolves.toEqual(expect.objectContaining({ id: 'c1' }));
    expect(prisma.conversation.create).toHaveBeenCalledWith({ data: { userId: 'u1', title: 'New Conversation' } });
    expect(logger.info).toHaveBeenCalledWith('Conversation created', expect.objectContaining({ conversationId: 'c1' }));
  });

  it('deletes only after ownership is verified', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
    await service.remove('c1', 'u1');
    expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('rejects access to another user conversation without mutating it', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'other' });
    await expect(service.remove('c1', 'u1')).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.conversation.delete).not.toHaveBeenCalled();
  });

  it('updates a title only after ownership is verified', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
    prisma.conversation.update.mockResolvedValue({ id: 'c1', title: 'Renamed' });
    await expect(service.updateTitle('c1', 'u1', 'Renamed')).resolves.toEqual(expect.objectContaining({ title: 'Renamed' }));
    expect(prisma.conversation.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { title: 'Renamed' } });
  });

  it('loads only configured recent history and restores chronological order', async () => {
    const { service, prisma } = setup({ maxHistoryMessages: 2 });
    prisma.message.findMany.mockResolvedValue([
      { role: 'ASSISTANT', content: 'new' }, { role: 'USER', content: 'old' },
    ]);
    await expect(service.loadHistory('c1')).resolves.toEqual([
      { role: 'USER', content: 'old' }, { role: 'ASSISTANT', content: 'new' },
    ]);
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });

  it('persists both messages, token usage, latency, and citations during chat', async () => {
    const { service, prisma, ragService } = setup({ inputCostPerMillion: 1, outputCostPerMillion: 2 });
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', title: 'New Conversation', _count: { messages: 0 } });
    prisma.message.findMany.mockResolvedValue([]);
    prisma.message.create
      .mockResolvedValueOnce({ id: 'm1', role: 'USER' })
      .mockResolvedValueOnce({ id: 'm2', role: 'ASSISTANT' });
    prisma.conversation.update.mockResolvedValue({});
    ragService.retrieve.mockResolvedValue([{ documentId: 'd1', originalName: 'guide.pdf', chunkIndex: 3, content: 'context' }]);
    ragService.llmService.generateDetailed.mockResolvedValue({
      answer: 'Grounded answer', usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    });

    const result = await service.chat('c1', 'u1', 'What is the policy?');

    expect(result.citations).toEqual([{ documentId: 'd1', originalName: 'guide.pdf', chunkIndex: 3 }]);
    expect(prisma.message.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ role: 'USER', content: 'What is the policy?' }) });
    expect(prisma.message.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({
      role: 'ASSISTANT', content: 'Grounded answer', promptTokens: 100,
      completionTokens: 20, totalTokens: 120, tokenCount: 120,
      citations: result.citations,
    }) });
    expect(ragService.promptBuilder.build).toHaveBeenCalledWith('What is the policy?', expect.any(Array), []);
    expect(prisma.conversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'What is the policy?' } }));
  });
});
