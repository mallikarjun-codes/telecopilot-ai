process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-sufficient-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const bcrypt = require('bcrypt');
const request = require('supertest');

jest.mock('../../db/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../services/session.service', () => ({
  createSession: jest.fn(),
  findSessionByToken: jest.fn(),
  rotateSession: jest.fn(),
  revokeSession: jest.fn(),
}));

const app = require('../../../app');
const prisma = require('../../db/prisma');
const sessionService = require('../services/session.service');
const tokenService = require('../services/token.service');

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: '',
  role: 'USER',
  isActive: true,
  createdAt,
  updatedAt: createdAt,
};

function authorizationFor(currentUser = user) {
  return `Bearer ${tokenService.issueAccessToken(currentUser)}`;
}

beforeAll(async () => {
  user.passwordHash = await bcrypt.hash('Password1!', 4);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/v1/auth/register', () => {
  it('registers a user, hashes the password, and creates a refresh session', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) => ({
      ...user,
      ...data,
    }));
    sessionService.createSession.mockResolvedValue({ id: 'session-1' });

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'TEST@example.com',
      password: 'Password1!',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: createdAt.toISOString(),
    });
    expect(response.body.data.user.passwordHash).toBeUndefined();

    const createData = prisma.user.create.mock.calls[0][0].data;
    expect(createData.passwordHash).not.toBe('Password1!');
    await expect(bcrypt.compare('Password1!', createData.passwordHash)).resolves.toBe(true);
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        refreshToken: response.body.data.refreshToken,
        expiresAt: expect.any(Date),
      })
    );
  });

  it('rejects invalid input', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'T',
      email: 'invalid',
      password: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: 'Validation failed.',
    }));
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: user.email,
      password: 'Password1!',
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with valid credentials and creates a refresh session', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    sessionService.createSession.mockResolvedValue({ id: 'session-1' });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: user.email,
      password: 'Password1!',
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
    }));
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(sessionService.createSession).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: user.email,
      password: 'WrongPassword1!',
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials.');
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the refresh session and returns a new token pair', async () => {
    const refreshToken = tokenService.issueRefreshToken(user);
    prisma.user.findUnique.mockResolvedValue(user);
    sessionService.findSessionByToken.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessionService.rotateSession.mockResolvedValue({ id: 'session-2' });

    const response = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.refreshToken).not.toBe(refreshToken);
    expect(sessionService.rotateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        refreshToken,
        newRefreshToken: response.body.data.refreshToken,
        newExpiresAt: expect.any(Date),
      })
    );
  });

  it('rejects revoked sessions', async () => {
    const refreshToken = tokenService.issueRefreshToken(user);
    prisma.user.findUnique.mockResolvedValue(user);
    sessionService.findSessionByToken.mockResolvedValue({
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken,
    });

    expect(response.status).toBe(401);
    expect(sessionService.rotateSession).not.toHaveBeenCalled();
  });

  it('rejects invalid refresh tokens', async () => {
    const response = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: 'invalid-token',
    });

    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the authenticated user refresh session', async () => {
    const refreshToken = tokenService.issueRefreshToken(user);
    sessionService.revokeSession.mockResolvedValue({ id: 'session-1' });

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', authorizationFor())
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
    expect(sessionService.revokeSession).toHaveBeenCalledWith({
      userId: user.id,
      refreshToken,
    });
  });

  it('rejects requests without authentication', async () => {
    const response = await request(app).post('/api/v1/auth/logout').send({
      refreshToken: tokenService.issueRefreshToken(user),
    });

    expect(response.status).toBe(401);
    expect(sessionService.revokeSession).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns only the current public user fields', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', authorizationFor());

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: createdAt.toISOString(),
    });
    expect(response.body.data.passwordHash).toBeUndefined();
  });

  it('rejects requests without authentication', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
