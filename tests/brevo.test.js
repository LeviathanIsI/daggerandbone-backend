import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrevoClient } from '../src/integrations/brevo.js';

const config = { apiKey: 'placeholder-key', listId: 42, senderName: 'Brand', senderEmail: 'brand@example.com', recipientEmail: 'inbox@example.com' };
function response(status, body = {}) { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }

test('contact notification uses verified sender and visitor reply-to', async () => {
  const calls = [];
  const client = createBrevoClient(config, async (url, options) => {
    calls.push({ url, options });
    return response(201, { messageId: 'mock-message' });
  });
  const result = await client.sendContact({ name: 'Visitor', email: 'visitor@example.com', message: 'A question for you.' });
  assert.equal(result.messageId, 'mock-message');
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.sender, { name: 'Brand', email: 'brand@example.com' });
  assert.deepEqual(body.replyTo, { name: 'Visitor', email: 'visitor@example.com' });
  assert.equal(body.to[0].email, 'inbox@example.com');
});

test('subscriber sync refuses list-level unsubscribe without a Brevo write', async () => {
  const calls = [];
  const client = createBrevoClient(config, async (url, options) => {
    calls.push({ url, method: options.method });
    return response(200, { emailBlacklisted: false, listIds: [42], listUnsubscribed: [42] });
  });
  await assert.rejects(client.addSubscriber('visitor@example.com'), { status: 409 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});

test('existing consenting contact is added only to the configured list', async () => {
  const calls = [];
  const client = createBrevoClient(config, async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? response(200, { emailBlacklisted: false, listIds: [8] }) : response(201, { success: ['visitor@example.com'], failure: [] });
  });
  await client.addSubscriber('visitor@example.com');
  assert.match(calls[1].url, /\/contacts\/lists\/42\/contacts\/add$/);
  assert.deepEqual(JSON.parse(calls[1].options.body), { emails: ['visitor@example.com'] });
});

test('missing list ID fails before touching Brevo', async () => {
  let called = false;
  const client = createBrevoClient({ ...config, listId: NaN }, async () => { called = true; return response(200); });
  await assert.rejects(client.addSubscriber('visitor@example.com'), { status: 503 });
  assert.equal(called, false);
});
