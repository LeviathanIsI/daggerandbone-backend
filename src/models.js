import mongoose from 'mongoose';

const { Schema } = mongoose;
const status = { type: String, enum: ['draft', 'published'], default: 'draft', index: true };
const seoSchema = new Schema({ title: { type: String, trim: true, maxlength: 90, default: '' }, description: { type: String, trim: true, maxlength: 200, default: '' } }, { _id: false });
const mediaSchema = new Schema({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, trim: true, default: '' },
  alt: { type: String, trim: true, maxlength: 250, default: '' },
  caption: { type: String, trim: true, maxlength: 500, default: '' },
  order: { type: Number, default: 0 },
  width: { type: Number, min: 0 },
  height: { type: Number, min: 0 }
}, { _id: false });

const contentOptions = { timestamps: true };
const scentSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  summary: { type: String, trim: true, maxlength: 500, default: '' },
  body: { type: String, trim: true, maxlength: 10000, default: '' },
  images: { type: [mediaSchema], default: [] },
  status,
  seo: { type: seoSchema, default: () => ({}) }
}, contentOptions);
scentSchema.index({ slug: 1 }, { unique: true });

const productSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  kind: { type: String, required: true, trim: true, maxlength: 100 },
  summary: { type: String, trim: true, maxlength: 500, default: '' },
  body: { type: String, trim: true, maxlength: 10000, default: '' },
  scent: { type: Schema.Types.ObjectId, ref: 'Scent', required: true, index: true },
  images: { type: [mediaSchema], default: [] },
  status,
  seo: { type: seoSchema, default: () => ({}) }
}, contentOptions);
productSchema.index({ slug: 1 }, { unique: true });

const pageSchema = new Schema({
  key: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9-]+$/ },
  slug: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  eyebrow: { type: String, trim: true, maxlength: 100, default: '' },
  intro: { type: String, trim: true, maxlength: 1000, default: '' },
  body: { type: String, trim: true, maxlength: 15000, default: '' },
  sections: { type: [new Schema({ heading: { type: String, trim: true, maxlength: 160 }, body: { type: String, trim: true, maxlength: 5000 } }, { _id: false })], default: [] },
  images: { type: [mediaSchema], default: [] },
  status,
  seo: { type: seoSchema, default: () => ({}) }
}, contentOptions);
pageSchema.index({ key: 1 }, { unique: true });
pageSchema.index({ slug: 1 }, { unique: true });

const rewardSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  summary: { type: String, trim: true, maxlength: 500, default: '' },
  body: { type: String, trim: true, maxlength: 5000, default: '' },
  order: { type: Number, default: 0 },
  status,
  seo: { type: seoSchema, default: () => ({}) }
}, contentOptions);
rewardSchema.index({ slug: 1 }, { unique: true });

const faqSchema = new Schema({
  question: { type: String, required: true, trim: true, maxlength: 300 },
  answer: { type: String, required: true, trim: true, maxlength: 5000 },
  order: { type: Number, default: 0 },
  status
}, contentOptions);

const settingsSchema = new Schema({
  key: { type: String, default: 'main', unique: true, immutable: true },
  brandName: { type: String, required: true, trim: true, maxlength: 160 },
  tagline: { type: String, trim: true, maxlength: 300, default: '' },
  kickstarterUrl: { type: String, trim: true, default: '' },
  kickstarterLaunchDate: { type: String, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  logo: { type: mediaSchema, default: null },
  favicon: { type: mediaSchema, default: null },
  homeImage: { type: mediaSchema, default: null },
  canonicalUrl: { type: String, trim: true, default: '' }
}, contentOptions);

const userSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['owner'], default: 'owner' },
  active: { type: Boolean, default: true }
}, contentOptions);

const contactSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ['new', 'read', 'handled'], default: 'new' },
  notificationStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  notificationError: { type: String, default: '' },
  brevoMessageId: { type: String, default: '' }
}, contentOptions);
contactSchema.index({ createdAt: -1 });

const subscriberSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  consent: { type: Boolean, required: true },
  consentAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'subscribed', 'integration_error', 'unsubscribe_pending', 'unsubscribed'], default: 'pending' },
  subscribedAt: Date,
  unsubscribedAt: Date,
  lastIntegrationError: { type: String, default: '' }
}, contentOptions);

export const Scent = mongoose.models.Scent || mongoose.model('Scent', scentSchema);
export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export const Page = mongoose.models.Page || mongoose.model('Page', pageSchema);
export const Reward = mongoose.models.Reward || mongoose.model('Reward', rewardSchema);
export const FAQ = mongoose.models.FAQ || mongoose.model('FAQ', faqSchema);
export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
export const Subscriber = mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema);
