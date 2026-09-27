import test from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { Settings, Page, Reward, Product, Scent, FAQ } from '../src/models.js';

test('snapshot route projects published CMS records without private media fields or an HTTP listener', async () => {
  const config = { frontendOrigin: 'http://localhost:3000', mongoUri: 'mongodb://unused', mongoDbName: 'unused',
    sessionSecret: 'an-offline-unit-test-secret-with-no-real-session', brevo: {}, cloudinary: {} };
  const original = [], queries = [];
  const scent = { _id: 's1', name: 'Mordant', slug: 'mordant', summary: '', body: '', images: [], seo: {} };
  const product = (id, slug, name) => ({ _id: id, name, slug, kind: 'shampoo', summary: '', body: '',
    scent: { _id: 's1', name: 'Mordant', slug: 'mordant', summary: '', status: 'published' },
    images: [{ url: 'https://example.test/image.jpg', alt: 'Saved image', publicId: 'private-cloud-id' }], seo: {} });
  const responses = [
    [Settings, 'findOne', { _id: 'settings', key: 'main', brandName: 'Dagger & Bone Apothecary', logo: { url: 'https://example.test/logo.jpg', publicId: 'private-logo-id' } }],
    [Page, 'find', [{ _id: 'page', key: 'products', slug: '/products', status: 'published', title: 'Saved CMS title', images: [] }]],
    [Reward, 'find', []],
    [Product, 'find', [product('p1', 'mordant-shampoo', 'Mordant Shampoo'), product('p2', 'mordant-conditioner', 'Mordant Conditioner'),
      { ...product('p3', 'hidden-product', 'Hidden Product'), scent: { _id: 's2', name: 'Draft', slug: 'draft', status: 'draft' } }]],
    [Scent, 'find', [scent]],
    [FAQ, 'find', [{ _id: 'faq', question: 'A saved question?', answer: 'A saved answer.', order: 1 }]],
  ];
  try {
    for (const [Model, method, data] of responses) {
      original.push([Model, method, Model[method]]);
      Model[method] = filter => {
        queries.push({ model: Model.modelName, filter });
        let selected = '';
        const chain = {
          select(fields) { selected = fields; return chain; },
          populate() { return chain; },
          sort() { return chain; },
          async lean() {
            const fields = new Set(['_id', ...selected.split(' ')]);
            const project = item => Object.fromEntries(Object.entries(item).filter(([key]) => fields.has(key)));
            return Array.isArray(data) ? data.map(project) : project(data);
          },
        };
        return chain;
      };
    }
    const app = createApp(config, { sessionStore: new session.MemoryStore(), brevo: {}, uploadImage: async () => ({}) });
    const router = app._router.stack.find(layer => layer.name === 'router' && layer.regexp.test('/api/public')).handle;
    const route = router.stack.find(layer => layer.route?.path === '/snapshot').route.stack[0].handle;
    let body, failure;
    await route({ method: 'GET', path: '/api/public/snapshot' }, { json(value) { body = value; } }, error => { failure = error; });
    assert.equal(failure, undefined);
    assert.equal(body.schemaVersion, 1);
    assert.equal(body.source, 'live-api');
    assert.equal(body.site.pages.products.title, 'Saved CMS title');
    assert.equal(body.products.length, 2);
    assert.equal(body.scents.length, 1);
    assert.equal(body.faqs.length, 1);
    assert.equal(body.productDetails['mordant-shampoo'].relatedProducts[0].slug, 'mordant-conditioner');
    assert.equal(body.scentDetails.mordant.relatedProducts.length, 2);
    assert.equal(JSON.stringify(body).includes('private-cloud-id'), false);
    assert.equal(JSON.stringify(body).includes('private-logo-id'), false);
    assert.equal(queries.filter(query => query.model !== 'Settings').every(query => query.filter.status === 'published'), true);
  } finally {
    for (const [Model, method, value] of original) Model[method] = value;
  }
});

test('public API serialization removes legacy private identity without changing the CMS record', () => {
  const config = { frontendOrigin: 'http://localhost:3000', mongoUri: 'mongodb://unused', mongoDbName: 'unused',
    sessionSecret: 'an-offline-unit-test-secret-with-no-real-session', brevo: {}, cloudinary: {} };
  const app = createApp(config, { sessionStore: new session.MemoryStore(), brevo: {}, uploadImage: async () => ({}) });
  const router = app._router.stack.find(layer => layer.name === 'router' && layer.regexp.test('/api/public')).handle;
  const stored = { intro: "We're Dagger & Bone Apothecary, based in St. Augustine. Josh, our founder, is developing our first collection.",
    seo: { description: 'Meet Joshua Bradford.' }, images: [{ alt: 'Portrait of Josh' }], title: 'About Dagger & Bone Apothecary' };
  let sent;
  const res = { json(payload) { sent = payload; return this; } };
  router.stack[0].handle({}, res, () => {});
  res.json(stored);
  assert.equal(sent.intro, "We're Dagger & Bone Apothecary, based in St. Augustine. Our first collection is in development.");
  assert.equal(sent.title, stored.title);
  assert.equal(sent.seo.description, '');
  assert.equal(sent.images[0].alt, '');
  assert.match(stored.intro, /Josh/);
  assert.doesNotMatch(JSON.stringify(sent), /\b(?:Josh(?:ua)?|Bradford)\b/i);
});
