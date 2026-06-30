'use strict';

const SemanticSearchService = require('../services/semantic-search.service');

describe('SemanticSearchService', () => {
  it('executes a parameterized, ranked search scoped to the user and ready documents', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'chunk-1', similarity: 0.9 }]) };
    const service = new SemanticSearchService({ prisma, topK: 3, threshold: 0.75 });

    await expect(service.search('user-1', [0.1, 0.2])).resolves.toHaveLength(1);
    const query = prisma.$queryRaw.mock.calls[0][0];
    const sql = query.strings.join('?');
    expect(sql).toContain('document."userId" =');
    expect(sql).toContain('document."status" = \'READY\'');
    expect(sql).toContain('ORDER BY chunk."embedding" <=>');
    expect(sql).toContain('LIMIT');
    expect(query.values).toEqual(expect.arrayContaining(['user-1', '[0.1,0.2]', 0.75, 3]));
  });

  it('rejects unsafe retrieval configuration', async () => {
    const service = new SemanticSearchService({ prisma: { $queryRaw: jest.fn() }, topK: 0 });
    await expect(service.search('user-1', [1])).rejects.toThrow('RAG_TOP_K');
  });
});
