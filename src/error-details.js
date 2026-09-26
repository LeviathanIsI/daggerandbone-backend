// Server-log diagnostics only. Never include these details in an HTTP response.
export function errorDetails(error, config = {}) {
  const secrets = [config.mongoUri, config.sessionSecret, config.brevo?.apiKey,
    config.cloudinary?.apiKey, config.cloudinary?.apiSecret].filter(value => typeof value === 'string' && value.length > 3);
  try {
    const uri = new URL(config.mongoUri);
    secrets.push(uri.username, uri.password);
  } catch {}
  const safe = value => {
    let message = String(value || '').replace(/:\/\/[^/@\s]+@/g, '://[redacted]@');
    for (const secret of secrets) if (secret) message = message.replaceAll(secret, '[redacted]');
    return message.slice(0, 500);
  };
  const servers = [...(error?.reason?.servers?.values() || [])].slice(0, 3).map(server => ({
    type: server.type,
    name: server.error?.name,
    code: server.error?.code || server.error?.cause?.code || undefined,
    message: safe(server.error?.message),
  }));
  return {
    name: error?.name || 'Error',
    code: error?.code || error?.cause?.code || undefined,
    message: safe(error?.message),
    ...(servers.length ? { servers } : {}),
  };
}
