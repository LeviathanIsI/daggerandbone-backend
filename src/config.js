import 'dotenv/config';

export function readConfig(env = process.env) {
  const hosted = env.NODE_ENV === 'production' || env.RENDER === 'true';
  const configuredOrigins = [env.FRONTEND_URL, env.FRONTEND_ORIGIN]
    .filter(Boolean)
    .map(value => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const frontendOrigins = [...new Set([
    ...configuredOrigins,
    ...(!hosted ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
  ])];
  return {
    port: Number(env.PORT || 4000),
    frontendOrigin: frontendOrigins[0],
    frontendOrigins,
    trustProxy: hosted || env.TRUST_PROXY === '1',
    secureCookies: hosted || env.COOKIE_SECURE === '1',
    mongoUri: env.MONGODB_URI,
    mongoDbName: env.MONGODB_DB_NAME || 'dagger_and_bone',
    sessionSecret: env.SESSION_SECRET,
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET
    },
    brevo: {
      apiKey: env.BREVO_API_KEY,
      listId: Number(env.BREVO_LIST_ID),
      senderName: env.BREVO_SENDER_NAME,
      senderEmail: env.BREVO_SENDER_EMAIL,
      recipientEmail: env.CONTACT_RECIPIENT_EMAIL
    }
  };
}

export function assertServerConfig(config) {
  const missing = [];
  if (!config.mongoUri) missing.push('MONGODB_URI');
  if (!config.sessionSecret || config.sessionSecret.length < 32) missing.push('SESSION_SECRET (32+ characters)');
  if (missing.length) throw new Error(`Missing required backend configuration: ${missing.join(', ')}`);
}
