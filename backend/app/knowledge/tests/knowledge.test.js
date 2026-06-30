process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-sufficient-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const fs = require('fs/promises');
const path = require('path');
const request = require('supertest');

jest.mock('../../db/prisma', () => ({
  knowledgeDocument: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../ingestion/queue/ingestion.queue', () => ({
  enqueue: jest.fn(() => true),
  setProcessor: jest.fn(),
}));

const app = require('../../../app');
const prisma = require('../../db/prisma');
const tokenService = require('../../auth/services/token.service');
const ingestionQueue = require('../../ingestion/queue/ingestion.queue');

const uploadsDirectory = path.resolve(__dirname, '../../../uploads');
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-01T00:00:00.000Z');
const user = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'USER',
};
const otherUser = {
  id: 'user-2',
  email: 'other@example.com',
  role: 'USER',
};

function authorizationFor(currentUser = user) {
  return `Bearer ${tokenService.issueAccessToken(currentUser)}`;
}

function documentRecord(overrides = {}) {
  return {
    id: 'document-1',
    userId: user.id,
    filename: 'stored-document.pdf',
    originalName: 'document.pdf',
    mimeType: 'application/pdf',
    size: 25,
    storagePath: 'uploads/stored-document.pdf',
    status: 'UPLOADING',
    createdAt,
    updatedAt,
    ...overrides,
  };
}

async function clearTestUploads() {
  const filenames = await fs.readdir(uploadsDirectory).catch(() => []);
  await Promise.all(
    filenames
      .filter((filename) => filename !== '.gitkeep')
      .map((filename) => fs.unlink(path.join(uploadsDirectory, filename)))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(clearTestUploads);

describe('POST /api/v1/knowledge/upload', () => {
  it('uploads a PDF and stores its metadata', async () => {
    prisma.knowledgeDocument.create.mockImplementation(({ data }) => ({
      id: 'document-1',
      status: 'UPLOADING',
      createdAt,
      updatedAt,
      ...data,
    }));

    const response = await request(app)
      .post('/api/v1/knowledge/upload')
      .set('Authorization', authorizationFor())
      .attach('file', Buffer.from('%PDF-1.4\ntest pdf'), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.document).toEqual(expect.objectContaining({
      id: 'document-1',
      originalName: 'document.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADING',
    }));
    expect(response.body.data.document.storagePath).toBeUndefined();
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
        storagePath: expect.stringMatching(/^uploads\//),
      }),
    });
    expect(ingestionQueue.enqueue).toHaveBeenCalledWith('document-1');

    const storedPath = prisma.knowledgeDocument.create.mock.calls[0][0].data.storagePath;
    await expect(fs.stat(path.resolve(__dirname, '../../..', storedPath))).resolves.toBeDefined();
  });

  it('rejects non-PDF files', async () => {
    const response = await request(app)
      .post('/api/v1/knowledge/upload')
      .set('Authorization', authorizationFor())
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'document.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Only PDF files are allowed.');
    expect(prisma.knowledgeDocument.create).not.toHaveBeenCalled();
  });

  it('requires an uploaded file', async () => {
    const response = await request(app)
      .post('/api/v1/knowledge/upload')
      .set('Authorization', authorizationFor());

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: 'Validation failed.',
      errors: [{ field: 'file', message: 'A PDF file is required.' }],
    }));
  });
});

describe('POST /api/v1/knowledge/:id/process', () => {
  it('manually enqueues an owned document', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue(documentRecord());

    const response = await request(app)
      .post('/api/v1/knowledge/document-1/process')
      .set('Authorization', authorizationFor());

    expect(response.status).toBe(202);
    expect(response.body.data).toEqual({ documentId: 'document-1', queued: true });
    expect(ingestionQueue.enqueue).toHaveBeenCalledWith('document-1');
  });
});

describe('GET /api/v1/knowledge', () => {
  it('lists only the authenticated user documents', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([{
      id: 'document-1',
      filename: 'stored-document.pdf',
      originalName: 'document.pdf',
      status: 'READY',
      createdAt,
    }]);

    const response = await request(app)
      .get('/api/v1/knowledge')
      .set('Authorization', authorizationFor());

    expect(response.status).toBe(200);
    expect(response.body.data.documents).toHaveLength(1);
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.id } })
    );
  });
});

describe('GET /api/v1/knowledge/:id', () => {
  it('returns document metadata to its owner', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue(documentRecord());

    const response = await request(app)
      .get('/api/v1/knowledge/document-1')
      .set('Authorization', authorizationFor());

    expect(response.status).toBe(200);
    expect(response.body.data.document.id).toBe('document-1');
    expect(response.body.data.document.storagePath).toBeUndefined();
  });

  it('returns 403 when another user owns the document', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue(documentRecord({
      userId: otherUser.id,
    }));

    const response = await request(app)
      .get('/api/v1/knowledge/document-1')
      .set('Authorization', authorizationFor());

    expect(response.status).toBe(403);
  });
});

describe('DELETE /api/v1/knowledge/:id', () => {
  it('deletes the database record and uploaded file', async () => {
    const storagePath = 'uploads/delete-me.pdf';
    await fs.writeFile(path.resolve(__dirname, '../../..', storagePath), 'pdf');
    prisma.knowledgeDocument.findUnique.mockResolvedValue(documentRecord({ storagePath }));
    prisma.knowledgeDocument.delete.mockResolvedValue(documentRecord({ storagePath }));

    const response = await request(app)
      .delete('/api/v1/knowledge/document-1')
      .set('Authorization', authorizationFor());

    expect(response.status).toBe(200);
    expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({
      where: { id: 'document-1' },
    });
    await expect(fs.stat(path.resolve(__dirname, '../../..', storagePath))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

describe('PATCH /api/v1/knowledge/:id/status', () => {
  it('validates and updates document status', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue(documentRecord());
    prisma.knowledgeDocument.update.mockResolvedValue(documentRecord({ status: 'READY' }));

    const response = await request(app)
      .patch('/api/v1/knowledge/document-1/status')
      .set('Authorization', authorizationFor())
      .send({ status: 'READY' });

    expect(response.status).toBe(200);
    expect(response.body.data.document.status).toBe('READY');
  });

  it('rejects an unsupported status', async () => {
    const response = await request(app)
      .patch('/api/v1/knowledge/document-1/status')
      .set('Authorization', authorizationFor())
      .send({ status: 'DELETED' });

    expect(response.status).toBe(400);
    expect(prisma.knowledgeDocument.update).not.toHaveBeenCalled();
  });
});

describe('knowledge authentication', () => {
  it('requires authentication for every knowledge route', async () => {
    const responses = await Promise.all([
      request(app).post('/api/v1/knowledge/upload'),
      request(app).get('/api/v1/knowledge'),
      request(app).get('/api/v1/knowledge/document-1'),
      request(app).delete('/api/v1/knowledge/document-1'),
      request(app).patch('/api/v1/knowledge/document-1/status').send({ status: 'READY' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
  });
});
