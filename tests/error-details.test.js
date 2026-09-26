import test from 'node:test';
import assert from 'node:assert/strict';
import { errorDetails } from '../src/error-details.js';

test('server diagnostics preserve actionable TLS details and redact configured secrets', () => {
  const config = { mongoUri: 'mongodb+srv://owner:private-password@example.invalid/', sessionSecret: 'session-secret-value', brevo: { apiKey: 'brevo-private-key' }, cloudinary: { apiSecret: 'cloudinary-private-key' } };
  const serverError = Object.assign(new Error('TLS rejected private-password at mongodb+srv://owner:private-password@example.invalid/'), { name: 'MongoNetworkError', cause: { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' } });
  const error = Object.assign(new Error('Could not connect using session-secret-value'), { name: 'MongoServerSelectionError', reason: { servers: new Map([['one', { type: 'Unknown', error: serverError }]]) } });
  const result = errorDetails(error, config);
  assert.equal(result.name, 'MongoServerSelectionError');
  assert.equal(result.servers[0].code, 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR');
  const logText = JSON.stringify(result);
  for (const secret of ['private-password', 'session-secret-value', 'brevo-private-key', 'cloudinary-private-key']) assert.equal(logText.includes(secret), false);
  assert.ok(logText.includes('[redacted]'));
});
