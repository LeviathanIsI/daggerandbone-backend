import test from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { User } from '../src/models.js';

const frontendUrl = 'https://daggerandbone.example';

test('Render CORS, proxy trust and cross-origin session cookies support login and logout', async () => {
  const config = readConfig({
    RENDER: 'true',
    FRONTEND_URL: `${frontendUrl}/`,
    MONGODB_URI: 'mongodb://unused',
    SESSION_SECRET: 'a-long-test-secret-that-is-not-used-in-production',
  });
  assert.deepEqual(config.frontendOrigins, [frontendUrl]);
  assert.equal(config.trustProxy, true);
  assert.equal(config.secureCookies, true);

  const password = 'a-long-test-password';
  const user = {
    _id: '507f1f77bcf86cd799439011', email: 'owner@example.com', role: 'owner', active: true,
    passwordHash: await bcrypt.hash(password, 4),
  };
  const findOne = User.findOne;
  const findById = User.findById;
  User.findOne = () => ({ select: async () => user });
  User.findById = () => ({ select: () => ({ lean: async () => user }) });
  try {
    const app = createApp(config, { sessionStore: new session.MemoryStore(), brevo: {}, uploadImage: async () => ({}) });
    assert.equal(app.get('trust proxy'), 1);
    const preflight = await supertest(app).options('/api/admin/login')
      .set('Origin', frontendUrl)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], frontendUrl);
    assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
    const disallowed = await supertest(app).get('/api/health').set('Origin', 'https://elsewhere.example');
    assert.equal(disallowed.headers['access-control-allow-origin'], undefined);
    assert.equal((await supertest(app).post('/api/admin/login').set('Origin', 'https://elsewhere.example').send({ email: user.email, password })).status, 403);

    const login = await supertest(app).post('/api/admin/login')
      .set('Origin', frontendUrl).set('X-Forwarded-Proto', 'https')
      .send({ email: user.email, password });
    assert.equal(login.status, 200);
    assert.equal(login.headers['access-control-allow-origin'], frontendUrl);
    const setCookie = login.headers['set-cookie']?.[0];
    assert.match(setCookie, /; Secure(?:;|$)/i);
    assert.match(setCookie, /; SameSite=None(?:;|$)/i);
    assert.match(setCookie, /; HttpOnly(?:;|$)/i);
    const cookie = setCookie.split(';')[0];
    assert.equal((await supertest(app).get('/api/admin/me').set('Origin', frontendUrl).set('Cookie', cookie)).status, 200);
    const logout = await supertest(app).post('/api/admin/logout')
      .set('Origin', frontendUrl).set('X-Forwarded-Proto', 'https').set('Cookie', cookie);
    assert.equal(logout.status, 200);
    assert.match(logout.headers['set-cookie']?.[0], /; SameSite=None(?:;|$)/i);
    assert.equal((await supertest(app).get('/api/admin/me').set('Origin', frontendUrl).set('Cookie', cookie)).status, 401);
  } finally {
    User.findOne = findOne;
    User.findById = findById;
  }
});

test('local development keeps localhost CORS and non-secure same-site cookies', () => {
  const config = readConfig({ FRONTEND_ORIGIN: 'http://localhost:3000' });
  assert.deepEqual(config.frontendOrigins, ['http://localhost:3000', 'http://127.0.0.1:3000']);
  assert.equal(config.trustProxy, false);
  assert.equal(config.secureCookies, false);
});
