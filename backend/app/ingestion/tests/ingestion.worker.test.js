'use strict';

const IngestionWorker = require('../workers/ingestion.worker');

function dependencies(overrides = {}) {
  const document = {
    id: 'document-1',
    storagePath: 'uploads/document.pdf',
    originalName: 'document.pdf',
  };
  return {
    prisma: {
      knowledgeDocument: { update: jest.fn().mockResolvedValue(document) },
    },
    embeddingService: { generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]) },
    extractPdfText: jest.fn().mockResolvedValue({ text: 'one two three', pageCount: 2 }),
    chunkText: jest.fn().mockReturnValue([
      { index: 0, content: 'one two' },
      { index: 1, content: 'two three' },
    ]),
    replaceDocumentChunks: jest.fn().mockResolvedValue(),
    logger: { info: jest.fn(), error: jest.fn() },
    ...overrides,
  };
}

describe('IngestionWorker', () => {
  it('transitions PROCESSING to READY and stores embedded chunks', async () => {
    const deps = dependencies();
    await new IngestionWorker(deps).process('document-1');

    expect(deps.prisma.knowledgeDocument.update.mock.calls[0][0].data.status).toBe('PROCESSING');
    expect(deps.replaceDocumentChunks).toHaveBeenCalledWith(
      'document-1',
      expect.arrayContaining([expect.objectContaining({ index: 0, embedding: [0.1, 0.2] })]),
      deps.prisma
    );
    expect(deps.prisma.knowledgeDocument.update.mock.calls.at(-1)[0].data.status).toBe('READY');
  });

  it('marks the document FAILED when extraction fails', async () => {
    const deps = dependencies({ extractPdfText: jest.fn().mockRejectedValue(new Error('corrupt PDF')) });
    await expect(new IngestionWorker(deps).process('document-1')).rejects.toThrow('corrupt PDF');
    expect(deps.prisma.knowledgeDocument.update.mock.calls.at(-1)[0].data.status).toBe('FAILED');
    expect(deps.replaceDocumentChunks).not.toHaveBeenCalled();
  });

  it('marks the document FAILED when no chunks can be produced', async () => {
    const deps = dependencies({ chunkText: jest.fn().mockReturnValue([]) });
    await expect(new IngestionWorker(deps).process('document-1')).rejects.toThrow('no extractable text');
    expect(deps.prisma.knowledgeDocument.update.mock.calls.at(-1)[0].data.status).toBe('FAILED');
  });
});
