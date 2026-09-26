import test from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { User } from '../src/models.js';
import { isAllowedImage } from '../src/integrations/cloudinary.js';

const config = { frontendOrigin: 'http://localhost:3000', mongoUri: 'mongodb://unused', mongoDbName: 'unused', sessionSecret: 'a-long-test-secret-that-is-not-used-in-production', cloudinary: {}, brevo: {} };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test('image validation checks file content as well as MIME and size', () => {
  assert.equal(isAllowedImage({ buffer: png, size: png.length, mimetype: 'image/png' }), true);
  assert.equal(isAllowedImage({ buffer: png, size: png.length, mimetype: 'image/jpeg' }), false);
  assert.equal(isAllowedImage({ buffer: png, size: 7 * 1024 * 1024, mimetype: 'image/png' }), false);
});

test('admin session protects uploads, rejects foreign origin, and logout clears access', async () => {
  const passwordHash = await bcrypt.hash('a-long-test-password', 4);
  const user = { _id: '507f1f77bcf86cd799439011', email: 'owner@example.com', role: 'owner', active: true, passwordHash };
  const findOne = User.findOne;
  const findById = User.findById;
  User.findOne = () => ({ select: async () => user });
  User.findById = () => ({ select: () => ({ lean: async () => user }) });
  try {
    const app = createApp(config, { sessionStore: new session.MemoryStore(), brevo: {}, uploadImage: async () => ({ url: 'https://example.com/image.png', publicId: 'mock' }) });
    const agent = supertest.agent(app);
    assert.equal((await agent.get('/api/admin/me')).status, 401);
    assert.equal((await agent.post('/api/admin/login').set('Origin', 'https://elsewhere.example').send({ email: user.email, password: 'a-long-test-password' })).status, 403);
    assert.equal((await agent.post('/api/admin/login').set('Origin', config.frontendOrigin).send({ email: user.email, password: 'wrong' })).status, 401);
    assert.equal((await agent.post('/api/admin/login').set('Origin', config.frontendOrigin).send({ email: user.email, password: 'a-long-test-password' })).status, 200);
    assert.equal((await agent.get('/api/admin/me')).status, 200);
    assert.equal((await agent.post('/api/admin/media').set('Origin', config.frontendOrigin).attach('file', png, { filename: 'image.png', contentType: 'image/png' })).status, 201);
    assert.equal((await agent.post('/api/admin/media').set('Origin', config.frontendOrigin).attach('file', png, { filename: 'fake.jpg', contentType: 'image/jpeg' })).status, 400);
    assert.equal((await agent.post('/api/admin/logout').set('Origin', config.frontendOrigin)).status, 200);
    assert.equal((await agent.get('/api/admin/me')).status, 401);
  } finally {
    User.findOne = findOne;
    User.findById = findById;
  }
});
