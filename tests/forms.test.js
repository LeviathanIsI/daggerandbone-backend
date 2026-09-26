import test from 'node:test';
import assert from 'node:assert/strict';
import { submitContact, subscribe, unsubscribe } from '../src/services/forms.js';

function record(fields) { return { ...fields, saves: 0, async save() { this.saves++; } }; }

test('contact delivery failure remains visible while submission persists', async () => {
  let saved;
  const Contact = { async create(fields) { saved = record(fields); return saved; } };
  const brevo = { async sendContact() { throw new Error('mock failure'); } };
  const result = await submitContact({ name: 'Visitor', email: 'VISITOR@example.com', message: 'Please get back to me.' }, { Contact, brevo });
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.equal(saved.email, 'visitor@example.com');
  assert.equal(saved.notificationStatus, 'failed');
  assert.equal(saved.saves, 1);
});

test('contact success records delivery ID and never subscribes', async () => {
  let saved;
  const Contact = { async create(fields) { saved = record(fields); return saved; } };
  const result = await submitContact({ name: 'Visitor', email: 'visitor@example.com', message: 'Please get back to me.' }, { Contact, brevo: { async sendContact() { return { messageId: 'mock-id' }; } } });
  assert.equal(result.status, 201);
  assert.equal(saved.notificationStatus, 'sent');
  assert.equal(saved.brevoMessageId, 'mock-id');
});

test('signup requires explicit consent and does not sync without it', async () => {
  let called = false;
  await assert.rejects(subscribe({ email: 'visitor@example.com', consent: false }, { Subscriber: { async findOne() { called = true; } }, brevo: {} }), { status: 400 });
  assert.equal(called, false);
});

test('signup failure is persisted as integration_error and reports failure', async () => {
  let saved;
  const Subscriber = { async findOne() { return null; }, async create(fields) { saved = record(fields); return saved; } };
  const result = await subscribe({ email: 'visitor@example.com', consent: true }, { Subscriber, brevo: { async addSubscriber() { throw new Error('mock failure'); } } });
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.equal(saved.consent, true);
  assert.equal(saved.status, 'integration_error');
});

test('an unsubscribed address cannot be silently rejoined', async () => {
  let called = false;
  const Subscriber = { async findOne() { return record({ status: 'unsubscribed' }); } };
  const result = await subscribe({ email: 'visitor@example.com', consent: true }, { Subscriber, brevo: { async addSubscriber() { called = true; } } });
  assert.equal(result.status, 409);
  assert.equal(called, false);
});

test('a locally subscribed address checks Brevo for a later external unsubscribe', async () => {
  const saved = record({ status: 'subscribed' });
  const Subscriber = { async findOne() { return saved; } };
  const result = await subscribe({ email: 'visitor@example.com', consent: true }, { Subscriber, brevo: { async addSubscriber() { throw Object.assign(new Error('Unsubscribed in Brevo'), { status: 409 }); } } });
  assert.equal(result.status, 409);
  assert.equal(saved.status, 'unsubscribed');
});

test('unsubscribe persists pending state and retries after Brevo failure', async () => {
  const saved = record({ status: 'subscribed' });
  const Subscriber = { async findOne() { return saved; } };
  const failed = await unsubscribe({ email: 'visitor@example.com' }, { Subscriber, brevo: { async removeSubscriber() { throw new Error('mock failure'); } } });
  assert.equal(failed.status, 503);
  assert.equal(saved.status, 'unsubscribe_pending');
  const ok = await unsubscribe({ email: 'visitor@example.com' }, { Subscriber, brevo: { async removeSubscriber() { return {}; } } });
  assert.equal(ok.status, 200);
  assert.equal(saved.status, 'unsubscribed');
  assert.match(failed.body.error, /request was saved, but we couldn't confirm/);
  assert.match(ok.body.message, /no longer subscribed to Dagger & Bone Apothecary updates/);
});

test('public validation explains the actual field constraints and consent requirement', async () => {
  await assert.rejects(submitContact({ name: '', email: 'invalid', message: 'short' }, {}), error => {
    assert.equal(error.status, 400);
    assert.deepEqual(error.details.fieldErrors, {
      name: ['Enter your name.'], email: ['Enter a valid email address.'], message: ['Write a message with at least 10 characters.'],
    });
    return true;
  });
  await assert.rejects(subscribe({ email: 'visitor@example.test', consent: false }, {}), error => {
    assert.deepEqual(error.details.fieldErrors.consent, ['Please agree to receive email updates before signing up.']);
    return true;
  });
});
