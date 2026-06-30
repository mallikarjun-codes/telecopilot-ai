'use strict';

const RagService = require('../services/rag.service');

function dependencies() {
  return {
    embeddingService: { generateEmbedding: jest.fn().mockResolvedValue([0.1]) },
    searchService: { search: jest.fn().mockResolvedValue([
      { documentId: 'doc-1', originalName: 'guide.pdf', chunkIndex: 2, content: 'Relevant' },
    ]) },
    promptBuilder: { build: jest.fn().mockReturnValue([{ role: 'system', content: 'prompt' }]) },
    llmService: { generate: jest.fn().mockResolvedValue('Answer') },
    logger: { info: jest.fn() },
  };
}

describe('RagService', () => {
  it('embeds, retrieves for the authenticated user, generates, and returns citations', async () => {
    const deps = dependencies();
    const service = new RagService(deps);
    await expect(service.answer('user-1', 'Question?')).resolves.toEqual({
      answer: 'Answer',
      citations: [{ documentId: 'doc-1', originalName: 'guide.pdf', chunkIndex: 2 }],
    });
    expect(deps.searchService.search).toHaveBeenCalledWith('user-1', [0.1]);
    expect(deps.llmService.generate).toHaveBeenCalledWith([{ role: 'system', content: 'prompt' }]);
  });

  it('keeps the user id on debug retrieval to protect ownership', async () => {
    const deps = dependencies();
    await new RagService(deps).retrieve('owner-id', 'Question?');
    expect(deps.searchService.search).toHaveBeenCalledWith('owner-id', [0.1]);
  });
});
