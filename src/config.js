import 'dotenv/config';

export function readConfig(env = process.env) {
  return {
    port: Number(env.PORT || 4000),
    frontendOrigin: env.FRONTEND_ORIGIN || 'http://localhost:3000',
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
