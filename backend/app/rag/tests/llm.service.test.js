'use strict';

const LLMService = require('../services/llm.service');

async function collect(iterator) {
  const output = [];
  for await (const item of iterator) output.push(item);
  return output;
}

describe('LLMService', () => {
  it('calls an OpenAI-compatible provider with configured generation settings', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: ' Grounded answer ' } }] }),
    });
    const service = new LLMService({
      provider: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.example/v1/',
      model: 'model', temperature: 0.1, maxTokens: 200, fetch,
    });
    const messages = [{ role: 'system', content: 'rules' }];

    await expect(service.generate(messages)).resolves.toBe('Grounded answer');
    expect(fetch).toHaveBeenCalledWith('https://llm.example/v1/chat/completions', expect.objectContaining({
      body: JSON.stringify({ model: 'model', messages, temperature: 0.1, max_tokens: 200 }),
    }));
  });

  it('rejects unimplemented provider adapters', async () => {
    const service = new LLMService({ provider: 'other', apiKey: 'key', baseUrl: 'x', model: 'm' });
    await expect(service.generate([])).rejects.toThrow('Unsupported LLM provider');
  });

  it('streams native provider tokens and final usage', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n\n',
      'data: [DONE]\n\n',
    ].map((chunk) => Buffer.from(chunk));
    const reader = {
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: chunks[0] })
        .mockResolvedValueOnce({ done: false, value: chunks[1] })
        .mockResolvedValueOnce({ done: false, value: chunks[2] })
        .mockResolvedValueOnce({ done: false, value: chunks[3] })
        .mockResolvedValueOnce({ done: true }),
      releaseLock: jest.fn(),
    };
    const fetch = jest.fn().mockResolvedValue({ ok: true, body: { getReader: () => reader } });
    const service = new LLMService({
      provider: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.example/v1',
      model: 'model', temperature: 0.1, maxTokens: 200, fetch,
    });
    const messages = [{ role: 'user', content: 'hello' }];

    await expect(collect(service.streamDetailed(messages))).resolves.toEqual([
      { token: 'Hel' },
      { token: 'lo' },
      { usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } },
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  it('simulates streaming from a completed response when native streaming is unavailable', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello world' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    });
    const service = new LLMService({
      provider: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.example/v1',
      model: 'model', fetch,
    });

    await expect(collect(service.streamDetailed([{ role: 'user', content: 'hello' }]))).resolves.toEqual([
      { token: 'Hello' },
      { token: ' ' },
      { token: 'world' },
      { usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
