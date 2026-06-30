'use strict';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-sufficient-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const request = require('supertest');
const app = require('../../../app');
const tokenService = require('../../auth/services/token.service');

const authorization = `Bearer ${tokenService.issueAccessToken({ id: 'user-1', role: 'USER' })}`;

describe('Conversation route security and validation', () => {
  it('requires authentication on every conversation operation', async () => {
    const responses = await Promise.all([
      request(app).post('/api/v1/conversations').send({}),
      request(app).get('/api/v1/conversations'),
      request(app).get('/api/v1/conversations/c1'),
      request(app).patch('/api/v1/conversations/c1').send({ title: 'Renamed' }),
      request(app).delete('/api/v1/conversations/c1'),
      request(app).post('/api/v1/conversations/c1/chat').send({ question: 'Valid question?' }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
  });

  it('validates chat questions and conversation ids before service execution', async () => {
    const [question, id] = await Promise.all([
      request(app).post('/api/v1/conversations/c1/chat').set('Authorization', authorization).send({ question: 'x' }),
      request(app).get(`/api/v1/conversations/${'x'.repeat(192)}`).set('Authorization', authorization),
    ]);
    expect([question.status, id.status]).toEqual([400, 400]);
    expect(question.body.message).toBe('Validation failed.');
  });

  it('validates optional titles', async () => {
    const response = await request(app).post('/api/v1/conversations')
      .set('Authorization', authorization).send({ title: '' });
    expect(response.status).toBe(400);
    const update = await request(app).patch('/api/v1/conversations/c1')
      .set('Authorization', authorization).send({ title: '' });
    expect(update.status).toBe(400);
  });
});
