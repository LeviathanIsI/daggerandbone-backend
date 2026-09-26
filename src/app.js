import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Contact, FAQ, Page, Product, Reward, Scent, Settings, Subscriber, User } from './models.js';
import { contentSchemas, email, parse, settingsSchema } from './validation.js';
import { createBrevoClient } from './integrations/brevo.js';
import { createImageUploader, isAllowedImage } from './integrations/cloudinary.js';
import { submitContact, subscribe, unsubscribe } from './services/forms.js';
import { errorDetails } from './error-details.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const idIsValid = (id) => mongoose.isValidObjectId(id);
const publicFields = {
  products: 'name slug kind summary body scent images seo updatedAt',
  scents: 'name slug summary body images seo updatedAt',
  pages: 'key slug title eyebrow intro body sections images seo updatedAt',
  rewards: 'title slug summary body order seo updatedAt',
  faqs: 'question answer order updatedAt'
};

function plain(document) { return document?.toObject ? document.toObject() : document; }
function publicMedia(media) {
  if (!media?.url) return null;
  return { url: media.url, alt: media.alt || '', caption: media.caption || '', order: media.order || 0, width: media.width, height: media.height };
}
function publicImages(images) { return (images || []).map(publicMedia).filter(Boolean).sort((a, b) => a.order - b.order); }
function publicContent(document) {
  const item = plain(document);
  return item && 'images' in item ? { ...item, images: publicImages(item.images) } : item;
}
function publicProduct(product) {
  const p = publicContent(product);
  if (!p?.scent || p.scent.status !== 'published') return null;
  const scent = plain(p.scent);
  return { ...p, scent: { _id: scent._id, name: scent.name, slug: scent.slug, summary: scent.summary } };
}
function csvEscape(value) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function createApp(config, overrides = {}) {
  const app = express();
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const sessionStore = overrides.sessionStore || MongoStore.create({ mongoUrl: config.mongoUri, dbName: config.mongoDbName, collectionName: 'sessions', ttl: 7 * 24 * 60 * 60 });
  app.use(session({
    name: 'daggerbone.sid',
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === '1', maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));
  const brevo = overrides.brevo || createBrevoClient(config.brevo);
  const uploadImage = overrides.uploadImage || createImageUploader(config.cloudinary);

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  const publicRouter = express.Router();
  publicRouter.get('/snapshot', asyncRoute(async (req, res) => {
    // One coherent, public-only projection for server rendering and the
    // frontend's durable last-published-content snapshot.
    const [settings, pages, rewards, products, scents, faqs] = await Promise.all([
      Settings.findOne({ key: 'main' }).select('brandName tagline kickstarterUrl kickstarterLaunchDate logo favicon homeImage canonicalUrl updatedAt').lean(),
      Page.find({ status: 'published' }).select(publicFields.pages).lean(),
      Reward.find({ status: 'published' }).select(publicFields.rewards).sort({ order: 1, title: 1 }).lean(),
      Product.find({ status: 'published' }).select(publicFields.products).populate('scent', 'name slug summary status').sort({ name: 1 }).lean(),
      Scent.find({ status: 'published' }).select(publicFields.scents).sort({ name: 1 }).lean(),
      FAQ.find({ status: 'published' }).select(publicFields.faqs).sort({ order: 1, createdAt: 1 }).lean(),
    ]);
    const publicSettings = settings ? { ...settings, logo: publicMedia(settings.logo), favicon: publicMedia(settings.favicon), homeImage: publicMedia(settings.homeImage) } : null;
    const publicProducts = products.map(publicProduct).filter(Boolean);
    const publicScents = scents.map(publicContent);
    const productsByScent = new Map(publicScents.map(scent => [String(scent._id), publicProducts.filter(product => String(product.scent._id) === String(scent._id))]));
    const productDetails = Object.fromEntries(publicProducts.map(product => [product.slug, {
      item: product,
      relatedProducts: (productsByScent.get(String(product.scent._id)) || []).filter(other => String(other._id) !== String(product._id)),
      relatedScents: [],
    }]));
    const scentDetails = Object.fromEntries(publicScents.map(scent => [scent.slug, {
      item: scent,
      relatedProducts: productsByScent.get(String(scent._id)) || [],
      relatedScents: [],
    }]));
    res.json({ schemaVersion: 1, capturedAt: new Date().toISOString(), source: 'live-api',
      site: { settings: publicSettings, pages: Object.fromEntries(pages.map(page => [page.key, publicContent(page)])), rewards },
      products: publicProducts, scents: publicScents, faqs, productDetails, scentDetails });
  }));
  publicRouter.get('/site', asyncRoute(async (req, res) => {
    const [settings, pages, rewards] = await Promise.all([
      Settings.findOne({ key: 'main' }).select('brandName tagline kickstarterUrl kickstarterLaunchDate logo favicon homeImage canonicalUrl updatedAt').lean(),
      Page.find({ status: 'published' }).select(publicFields.pages).lean(),
      Reward.find({ status: 'published' }).select(publicFields.rewards).sort({ order: 1, title: 1 }).lean()
    ]);
    const publicSettings = settings ? { ...settings, logo: publicMedia(settings.logo), favicon: publicMedia(settings.favicon), homeImage: publicMedia(settings.homeImage) } : null;
    res.json({ settings: publicSettings, pages: Object.fromEntries(pages.map((p) => [p.key, publicContent(p)])), rewards });
  }));
  publicRouter.get('/products', asyncRoute(async (req, res) => {
    const products = await Product.find({ status: 'published' }).select(publicFields.products).populate('scent', 'name slug summary status').sort({ name: 1 }).lean();
    res.json({ items: products.map(publicProduct).filter(Boolean) });
  }));
  publicRouter.get('/products/:slug', asyncRoute(async (req, res) => {
    const product = await Product.findOne({ slug: req.params.slug, status: 'published' }).select(publicFields.products).populate('scent', 'name slug summary status').lean();
    const item = publicProduct(product);
    if (!item) return res.status(404).json({ error: 'Product not found' });
    const related = await Product.find({ status: 'published', scent: item.scent._id, _id: { $ne: item._id } }).select(publicFields.products).populate('scent', 'name slug summary status').sort({ name: 1 }).lean();
    res.json({ item, relatedProducts: related.map(publicProduct).filter(Boolean), relatedScents: [] });
  }));
  publicRouter.get('/scents', asyncRoute(async (req, res) => {
    const items = await Scent.find({ status: 'published' }).select(publicFields.scents).sort({ name: 1 }).lean();
    res.json({ items: items.map(publicContent) });
  }));
  publicRouter.get('/scents/:slug', asyncRoute(async (req, res) => {
    const item = await Scent.findOne({ slug: req.params.slug, status: 'published' }).select(publicFields.scents).lean();
    if (!item) return res.status(404).json({ error: 'Scent not found' });
    const relatedProducts = await Product.find({ scent: item._id, status: 'published' }).select(publicFields.products).populate('scent', 'name slug summary status').sort({ name: 1 }).lean();
    res.json({ item: publicContent(item), relatedProducts: relatedProducts.map(publicProduct).filter(Boolean), relatedScents: [] });
  }));
  publicRouter.get('/faqs', asyncRoute(async (req, res) => {
    const items = await FAQ.find({ status: 'published' }).select(publicFields.faqs).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ items });
  }));
  publicRouter.get('/rewards', asyncRoute(async (req, res) => {
    const items = await Reward.find({ status: 'published' }).select(publicFields.rewards).sort({ order: 1, title: 1 }).lean();
    res.json({ items });
  }));
  const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { ok: false, error: 'Too many requests. Please try again later.' } });
  publicRouter.post('/contact', formLimiter, asyncRoute(async (req, res) => {
    const result = await submitContact(req.body, { Contact, brevo });
    res.status(result.status).json(result.body);
  }));
  publicRouter.post('/subscribe', formLimiter, asyncRoute(async (req, res) => {
    const result = await subscribe(req.body, { Subscriber, brevo });
    res.status(result.status).json(result.body);
  }));
  publicRouter.post('/unsubscribe', formLimiter, asyncRoute(async (req, res) => {
    const result = await unsubscribe(req.body, { Subscriber, brevo });
    res.status(result.status).json(result.body);
  }));
  app.use('/api/public', publicRouter);

  const admin = express.Router();
  admin.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && origin !== config.frontendOrigin) return res.status(403).json({ error: 'Invalid request origin' });
    }
    next();
  });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Try again later.' } });
  admin.post('/login', loginLimiter, asyncRoute(async (req, res) => {
    const data = parse(z.object({ email, password: z.string().min(1).max(200) }), req.body);
    const user = await User.findOne({ email: data.email, active: true }).select('+passwordHash');
    const valid = user && await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.userId = user._id.toString();
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    res.json({ user: { _id: user._id, email: user.email, role: user.role } });
  }));
  admin.use(asyncRoute(async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
    const user = await User.findById(req.session.userId).select('_id email role active').lean();
    if (!user?.active || user.role !== 'owner') return res.status(403).json({ error: 'Access denied' });
    req.adminUser = user;
    next();
  }));
  admin.get('/me', (req, res) => res.json({ user: req.adminUser }));
  admin.post('/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('daggerbone.sid');
      res.json({ ok: true });
    });
  });

  admin.get('/settings', asyncRoute(async (req, res) => {
    const item = await Settings.findOne({ key: 'main' }).lean();
    res.json({ item });
  }));
  admin.patch('/settings', asyncRoute(async (req, res) => {
    const data = parse(settingsSchema.partial(), req.body);
    const item = await Settings.findOne({ key: 'main' });
    if (!item) return res.status(404).json({ error: 'Settings not found' });
    item.set(data);
    await item.save();
    res.json({ item });
  }));

  const resources = { products: Product, scents: Scent, pages: Page, rewards: Reward, faqs: FAQ };
  const sorting = { products: { name: 1 }, scents: { name: 1 }, pages: { key: 1 }, rewards: { order: 1, title: 1 }, faqs: { order: 1, createdAt: 1 } };
  for (const [name, Model] of Object.entries(resources)) {
    admin.get(`/${name}`, asyncRoute(async (req, res) => {
      const items = await Model.find().sort(sorting[name]).lean();
      res.json({ items });
    }));
    admin.get(`/${name}/:id`, asyncRoute(async (req, res) => {
      if (!idIsValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const item = await Model.findById(req.params.id).lean();
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json({ item });
    }));
    admin.post(`/${name}`, asyncRoute(async (req, res) => {
      const data = parse(contentSchemas[name], req.body);
      if (name === 'products' && !await Scent.exists({ _id: data.scent })) return res.status(400).json({ error: 'Choose an existing scent' });
      const item = await Model.create(data);
      res.status(201).json({ item });
    }));
    admin.patch(`/${name}/:id`, asyncRoute(async (req, res) => {
      if (!idIsValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const data = parse(contentSchemas[name].partial(), req.body);
      if (name === 'products' && data.scent && !await Scent.exists({ _id: data.scent })) return res.status(400).json({ error: 'Choose an existing scent' });
      const item = await Model.findById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      item.set(data);
      await item.save();
      res.json({ item });
    }));
    admin.delete(`/${name}/:id`, asyncRoute(async (req, res) => {
      if (!idIsValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
      if (name === 'scents' && await Product.exists({ scent: req.params.id })) return res.status(409).json({ error: 'Remove or reassign products before deleting this scent' });
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    }));
  }

  const multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 1 }, fileFilter: (req, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'].includes(file.mimetype)) return callback(Object.assign(new Error('Unsupported image type'), { status: 400 }));
    callback(null, true);
  } });
  admin.post('/media', multerUpload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose an image file' });
    if (!isAllowedImage(req.file)) return res.status(400).json({ error: 'Use a PNG, JPEG, GIF, WebP, or AVIF image up to 6 MB.' });
    const item = await uploadImage(req.file);
    res.status(201).json({ item });
  }));

  admin.get('/submissions', asyncRoute(async (req, res) => {
    const items = await Contact.find().sort({ createdAt: -1 }).lean();
    res.json({ items });
  }));
  admin.patch('/submissions/:id', asyncRoute(async (req, res) => {
    if (!idIsValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const { status } = parse(z.object({ status: z.enum(['new', 'read', 'handled']) }), req.body);
    const item = await Contact.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).lean();
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
  }));
  admin.get('/subscribers', asyncRoute(async (req, res) => {
    const items = await Subscriber.find().sort({ createdAt: -1 }).lean();
    res.json({ items });
  }));
  admin.get('/subscribers.csv', asyncRoute(async (req, res) => {
    const rows = await Subscriber.find().sort({ createdAt: -1 }).lean();
    const csv = ['email,consent,consentAt,status,subscribedAt,unsubscribedAt', ...rows.map((row) => [row.email, row.consent, row.consentAt?.toISOString(), row.status, row.subscribedAt?.toISOString(), row.unsubscribedAt?.toISOString()].map(csvEscape).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dagger-and-bone-subscribers.csv"');
    res.send(`\ufeff${csv}\r\n`);
  }));
  admin.patch('/subscribers/:id', asyncRoute(async (req, res) => {
    if (!idIsValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const { status } = parse(z.object({ status: z.enum(['unsubscribed', 'subscribed']) }), req.body);
    const item = await Subscriber.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (status === 'subscribed') {
      if (!item.consent || item.status === 'unsubscribed' || item.status === 'unsubscribe_pending') return res.status(409).json({ error: 'A previously unsubscribed address needs fresh consent' });
      try { await brevo.addSubscriber(item.email); } catch (error) {
        if (error.status === 409) {
          item.status = 'unsubscribed';
          item.unsubscribedAt = new Date();
          await item.save();
          return res.status(409).json({ error: 'This address is unsubscribed in Brevo' });
        }
        return res.status(503).json({ error: 'Subscription could not be confirmed' });
      }
      item.status = 'subscribed';
      item.subscribedAt = new Date();
    } else {
      item.status = 'unsubscribe_pending';
      await item.save();
      try { await brevo.removeSubscriber(item.email); } catch { return res.status(503).json({ error: 'Unsubscribe could not be confirmed' }); }
      item.status = 'unsubscribed';
      item.unsubscribedAt = new Date();
    }
    item.lastIntegrationError = '';
    await item.save();
    res.json({ item });
  }));
  app.use('/api/admin', admin);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 6 MB or smaller' : 'Invalid upload' });
    if (error.code === 11000) return res.status(409).json({ error: 'A record with this unique value already exists' });
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ error: 'Invalid data' });
    if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message, ...(error.details ? { details: error.details } : {}) });
    console.error('Unhandled API error', { request: `${req.method} ${req.path}`, ...errorDetails(error, config) });
    res.status(error.status >= 500 ? error.status : 500).json({ error: 'Server error' });
  });
  return app;
}
