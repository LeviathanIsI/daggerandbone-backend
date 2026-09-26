export class BrevoError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'BrevoError';
    this.status = status;
  }
}

export function createBrevoClient(config, fetchImpl = globalThis.fetch) {
  const base = 'https://api.brevo.com/v3';
  async function request(path, method = 'GET', body) {
    if (!config.apiKey) throw new BrevoError('Brevo is not configured');
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: { 'api-key': config.apiKey, accept: 'application/json', 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000)
      });
    } catch {
      throw new BrevoError('Brevo is unavailable');
    }
    if (response.status === 404 && method === 'GET') return { notFound: true };
    if (!response.ok) throw new BrevoError('Brevo request failed', response.status >= 500 ? 503 : 502);
    if (response.status === 204) return {};
    try { return await response.json(); } catch { return {}; }
  }

  function requireListId() {
    if (!Number.isSafeInteger(config.listId) || config.listId <= 0) throw new BrevoError('Brevo subscriber list is not configured');
    return config.listId;
  }

  return {
    async sendContact({ name, email, message }) {
      if (!config.senderEmail || !config.recipientEmail) throw new BrevoError('Brevo mail sender is not configured');
      return request('/smtp/email', 'POST', {
        sender: { name: config.senderName || 'Dagger & Bone Apothecary', email: config.senderEmail },
        to: [{ email: config.recipientEmail }],
        replyTo: { name, email },
        subject: `Website contact from ${name}`,
        textContent: `New website contact\n\nName: ${name}\nEmail: ${email}\n\n${message}`
      });
    },
    async addSubscriber(email) {
      const listId = requireListId();
      const existing = await request(`/contacts/${encodeURIComponent(email)}`);
      if (!existing.notFound) {
        if (existing.emailBlacklisted || existing.listUnsubscribed?.includes(listId)) throw new BrevoError('This address is unsubscribed in Brevo', 409);
        if (Array.isArray(existing.listIds) && existing.listIds.includes(listId)) return { alreadyPresent: true };
        const added = await request(`/contacts/lists/${listId}/contacts/add`, 'POST', { emails: [email] });
        if (added.failure?.includes(email)) throw new BrevoError('Brevo rejected this subscription');
        return { alreadyPresent: false };
      }
      await request('/contacts', 'POST', { email, listIds: [listId], updateEnabled: false });
      return { alreadyPresent: false };
    },
    async removeSubscriber(email) {
      const listId = requireListId();
      const existing = await request(`/contacts/${encodeURIComponent(email)}`);
      if (existing.notFound || !existing.listIds?.includes(listId)) return { alreadyRemoved: true };
      const removed = await request(`/contacts/lists/${listId}/contacts/remove`, 'POST', { emails: [email] });
      if (removed.failure?.includes(email)) throw new BrevoError('Brevo rejected this unsubscribe');
      return { alreadyRemoved: false };
    }
  };
}
