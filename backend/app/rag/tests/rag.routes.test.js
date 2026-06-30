'use strict';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-sufficient-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const request = require('supertest');
const app = require('../../../app');
const tokenService = require('../../auth/services/token.service');

const authorization = `Bearer ${tokenService.issueAccessToken({ id: 'user-1', role: 'USER' })}`;

describe('RAG route security and validation', () => {
  it('requires authentication for chat and search', async () => {
    const [chat, search] = await Promise.all([
      request(app).post('/api/v1/chat').send({ question: 'A valid question?' }),
      request(app).get('/api/v1/chat/search?q=A%20valid%20question'),
    ]);
    expect([chat.status, search.status]).toEqual([401, 401]);
  });

  it('validates question length before invoking RAG', async () => {
    const [chat, search] = await Promise.all([
      request(app).post('/api/v1/chat').set('Authorization', authorization).send({ question: 'x' }),
      request(app).get('/api/v1/chat/search?q=x').set('Authorization', authorization),
    ]);
    expect([chat.status, search.status]).toEqual([400, 400]);
    expect(chat.body.message).toBe('Validation failed.');
  });
});
