'use strict';

const EmbeddingService = require('../services/embedding.service');

const configuration = {
  apiKey: 'key',
  baseUrl: 'https://embeddings.example/v1/',
  model: 'configured-model',
};

describe('EmbeddingService', () => {
  it('uses OpenAI-compatible configuration and returns an embedding', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
    });
    const service = new EmbeddingService({ ...configuration, fetch });

    await expect(service.generateEmbedding('hello')).resolves.toEqual([0.1, 0.2]);
    expect(fetch).toHaveBeenCalledWith(
      'https://embeddings.example/v1/embeddings',
      expect.objectContaining({ body: JSON.stringify({ model: 'configured-model', input: 'hello' }) })
    );
  });

  it('retries three times with exponential backoff', async () => {
    const fetch = jest.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ embedding: [1] }] }) });
    const sleep = jest.fn().mockResolvedValue();
    const service = new EmbeddingService({ ...configuration, fetch, sleep, baseDelayMs: 10 });

    await expect(service.generateEmbedding('hello')).resolves.toEqual([1]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it('throws after the maximum attempts', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const service = new EmbeddingService({ ...configuration, fetch, sleep: jest.fn() });
    await expect(service.generateEmbedding('hello')).rejects.toThrow('offline');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
