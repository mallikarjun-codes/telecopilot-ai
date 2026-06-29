const bcrypt = require('bcrypt');
const crypto = require('crypto');

jest.mock('../../db/prisma', () => ({
  refreshSession: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require('../../db/prisma');
const sessionService = require('../services/session.service');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
});

it('stores refresh tokens as bcrypt hashes', async () => {
  const refreshToken = 'raw-refresh-token';
  const expiresAt = new Date(Date.now() + 60_000);
  prisma.refreshSession.create.mockImplementation(({ data }) => ({
    id: 'session-1',
    ...data,
  }));

  await sessionService.createSession({
    userId: 'user-1',
    refreshToken,
    expiresAt,
  });

  const storedHash = prisma.refreshSession.create.mock.calls[0][0].data.tokenHash;
  expect(storedHash).not.toBe(refreshToken);
  const tokenDigest = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await expect(bcrypt.compare(tokenDigest, storedHash)).resolves.toBe(true);
});

it('revokes the old session and creates a separately hashed session on rotation', async () => {
  const commonJwtPrefix = 'a'.repeat(80);
  const oldToken = `${commonJwtPrefix}-old-refresh-token`;
  const newToken = `${commonJwtPrefix}-new-refresh-token`;
  const oldTokenDigest = crypto.createHash('sha256').update(oldToken).digest('hex');
  const oldTokenHash = await bcrypt.hash(oldTokenDigest, 4);
  const newExpiresAt = new Date(Date.now() + 60_000);

  prisma.refreshSession.findMany.mockResolvedValue([{
    id: 'session-1',
    userId: 'user-1',
    tokenHash: oldTokenHash,
    expiresAt: new Date(Date.now() + 30_000),
    revokedAt: null,
    createdAt: new Date(),
  }]);
  prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });
  prisma.refreshSession.create.mockImplementation(({ data }) => ({
    id: 'session-2',
    ...data,
  }));

  const result = await sessionService.rotateSession({
    userId: 'user-1',
    refreshToken: oldToken,
    newRefreshToken: newToken,
    newExpiresAt,
  });

  expect(result.id).toBe('session-2');
  expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
    where: { id: 'session-1', revokedAt: null },
    data: { revokedAt: expect.any(Date) },
  });

  const newTokenHash = prisma.refreshSession.create.mock.calls[0][0].data.tokenHash;
  expect(newTokenHash).not.toBe(newToken);
  expect(newTokenHash).not.toBe(oldTokenHash);
  const newTokenDigest = crypto.createHash('sha256').update(newToken).digest('hex');
  await expect(bcrypt.compare(newTokenDigest, newTokenHash)).resolves.toBe(true);
  await expect(bcrypt.compare(oldTokenDigest, newTokenHash)).resolves.toBe(false);
});
