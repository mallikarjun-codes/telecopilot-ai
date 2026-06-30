'use strict';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-sufficient-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const http = require('http');

jest.mock('../services/agent.service', () => jest.fn().mockImplementation(() => ({
  chat: jest.fn(async () => ({
    conversationId: 'c1', answer: 'Hello', citations: [], usage: {}, latency: 3,
    agent: { action: 'DIRECT', retrievedChunks: 0, confidence: 0.99, latency: 3 },
  })),
})));
jest.mock('../services/agent-stream.service', () => jest.fn().mockImplementation(() => ({
  stream: jest.fn(async (userId, input, emit) => {
    emit('start', { conversationId: 'c1' });
    emit('token', 'Hello');
    emit('citation', { documentId: 'd1' });
    emit('metadata', { latency: 3, usage: { totalTokens: 1 } });
    emit('done', { conversationId: 'c1' });
  }),
})));

const request = require('supertest');
const app = require('../../../app');
const tokenService = require('../../auth/services/token.service');
const AgentStreamService = require('../services/agent-stream.service');

const authorization = `Bearer ${tokenService.issueAccessToken({ id: 'user-1', role: 'USER' })}`;

describe('POST /api/v1/agent/chat', () => {
  it('requires authentication', async () => {
    const response = await request(app).post('/api/v1/agent/chat').send({ message: 'hello' });
    expect(response.status).toBe(401);
  });

  it('validates input and rejects oversized or extra fields', async () => {
    const [empty, oversized, extra] = await Promise.all([
      request(app).post('/api/v1/agent/chat').set('Authorization', authorization).send({ message: '' }),
      request(app).post('/api/v1/agent/chat').set('Authorization', authorization).send({ message: 'x'.repeat(2001) }),
      request(app).post('/api/v1/agent/chat').set('Authorization', authorization).send({ message: 'hello', admin: true }),
    ]);
    expect([empty.status, oversized.status, extra.status]).toEqual([400, 400, 400]);
  });

  it('returns the agent response envelope', async () => {
    const response = await request(app).post('/api/v1/agent/chat')
      .set('Authorization', authorization).send({ message: 'hello' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { conversationId: 'c1', agent: { action: 'DIRECT' } } });
  });
});

describe('POST /api/v1/agent/chat/stream', () => {
  it('requires authentication', async () => {
    expect((await request(app).post('/api/v1/agent/chat/stream').send({ message: 'hello' })).status).toBe(401);
  });

  it('returns a complete authenticated SSE stream', async () => {
    const response = await request(app).post('/api/v1/agent/chat/stream')
      .set('Authorization', authorization).send({ message: 'hello' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    expect(response.text).toContain('event: token\ndata: "Hello"');
    expect(response.text).toContain('event: citation');
    expect(response.text).toContain('event: metadata');
    expect(response.text).toContain('event: done');
  });

  it('aborts stream work when the client disconnects', async () => {
    const streamMock = AgentStreamService.mock.results[0].value.stream;
    let capturedSignal;
    let release;
    streamMock.mockImplementationOnce(async (userId, input, emit, signal) => {
      capturedSignal = signal;
      emit('start', { conversationId: 'c1' });
      await new Promise((resolve) => { release = resolve; });
    });

    const server = app.listen(0);
    try {
      const { port } = server.address();
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/api/v1/agent/chat/stream',
          method: 'POST',
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
          },
        }, (res) => {
          res.once('data', () => {
            req.destroy();
            res.destroy();
            setImmediate(resolve);
          });
          res.once('error', (error) => {
            if (error.code === 'ECONNRESET') resolve();
            else reject(error);
          });
        });
        req.once('error', (error) => {
          if (error.code === 'ECONNRESET') resolve();
          else reject(error);
        });
        req.end(JSON.stringify({ message: 'hello' }));
      });
      for (let attempt = 0; attempt < 20 && !capturedSignal.aborted; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(capturedSignal.aborted).toBe(true);
    } finally {
      if (release) release();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
