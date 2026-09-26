import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { readConfig } from '../src/config.js';
import { Page, Product, Reward, Settings } from '../src/models.js';

// A one-time, targeted editorial update. This does not seed or publish records.
// Stored outside src so running it does not touch nodemon's watched files.
const revision = 'brand-refinement-2026-09-23';
const archive = new URL('../.content-revisions/', import.meta.url);
const marker = new URL(`${revision}.complete.json`, archive);
const brand = 'Dagger & Bone Apothecary';
const changes = [
  [Page, { key: 'home' }, {
    title: "Your masculinity isn't water-soluble.",
    intro: "Men's hair, skin, and body care built around custom scents and botanical packaging.",
    body: '',
  }],
  [Page, { key: 'products' }, {
    eyebrow: 'THE FIRST COLLECTION', title: 'Hair. Skin. Body.',
    intro: 'Seven products. Three opening scents.', body: 'In development',
  }],
  [Page, { key: 'scents' }, {
    intro: 'Three opening scents. Find the products planned for each.', body: '',
    'seo.description': 'Explore Cordovan, Mordant, and Flint, the opening Dagger & Bone Apothecary scents, and the products planned for each.',
  }],
  [Page, { key: 'about' }, {
    body: [
      "Dagger & Bone Apothecary brings custom scents and an irreverent attitude to men's hair, skin, and body care.",
      'Nobody needs to prove anything to a bottle of conditioner.',
      'Based in St. Augustine, Florida.',
      "We're developing the first collection now. Follow the Kickstarter launch for campaign and founding reward details.",
    ].join('\n\n'),
  }],
  [Page, { key: 'kickstarter' }, { body: '' }],
  [Reward, { slug: 'create-a-soap' }, { summary: '' }],
  [Settings, { key: 'main' }, { tagline: "Men's hair, skin, and body care. Custom scents. Botanical packaging." }],
];
const products = [
  ['cordovan-body-wash', 'Cordovan Body Wash'], ['cordovan-hand-lotion', 'Cordovan Hand Lotion'],
  ['cordovan-body-lotion', 'Cordovan Body Lotion'], ['mordant-shampoo', 'Mordant Shampoo'],
  ['mordant-conditioner', 'Mordant Conditioner'], ['mordant-bar-soap', 'Mordant Bar Soap'], ['flint-cologne', 'Flint Cologne'],
];
for (const [slug, name] of products) changes.push([Product, { slug }, {
  summary: '', body: '',
  'seo.description': `${name} is part of ${brand}'s first collection. In development; follow the Kickstarter launch.`,
}]);

function valueAt(record, path) { return path.split('.').reduce((value, key) => value?.[key], record); }
function untouched(record, fields) {
  const copy = JSON.parse(JSON.stringify(record));
  for (const path of [...fields, 'updatedAt']) {
    const keys = path.split('.');
    const key = keys.pop();
    const parent = keys.reduce((value, part) => value?.[part], copy);
    if (parent) delete parent[key];
  }
  return copy;
}

const apply = process.argv.includes('--apply');
const config = readConfig();
try {
  const alreadyApplied = await readFile(marker, 'utf8').then(() => true).catch((error) => { if (error.code === 'ENOENT') return false; throw error; });
  if (alreadyApplied) {
    console.log('This editorial revision is already complete; no content changed.');
  } else {
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, autoIndex: false, autoCreate: false });
    const plan = [];
    for (const [model, filter, fields] of changes) {
      const before = await model.findOne(filter).lean();
      if (!before) throw new Error(`Missing ${model.modelName} record; nothing applied.`);
      const update = Object.fromEntries(Object.entries(fields).filter(([path, value]) => valueAt(before, path) !== value));
      if (Object.keys(update).length) plan.push({ model, before, update });
    }
    console.log(`${plan.length} existing records have targeted editorial changes.`);
    if (!apply) {
      for (const { model, before, update } of plan) console.log(`${model.modelName}: ${before.key || before.slug}; fields: ${Object.keys(update).join(', ')}`);
      console.log('Preview only. Run with --apply to persist this revision.');
    } else {
      await mkdir(archive, { recursive: true });
      await writeFile(new URL('.gitignore', archive), '*\n!.gitignore\n');
      const backupName = `${revision}-${Date.now()}.json`;
      await writeFile(new URL(backupName, archive), JSON.stringify(plan.map(({ model, before, update }) => ({ model: model.modelName, before, update })), null, 2), { flag: 'wx' });
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          for (const { model, before, update } of plan) {
            const result = await model.updateOne({ _id: before._id, updatedAt: before.updatedAt }, { $set: update }, { session, runValidators: true });
            if (result.modifiedCount !== 1) throw new Error('Content changed concurrently; the revision was rolled back.');
            const after = await model.findById(before._id).session(session).lean();
            if (!isDeepStrictEqual(untouched(before, Object.keys(update)), untouched(after, Object.keys(update)))) throw new Error('An unrelated field changed; revision rolled back.');
            if (Object.entries(update).some(([path, value]) => valueAt(after, path) !== value)) throw new Error('Updated content did not match the revision.');
          }
        });
      } finally { await session.endSession(); }
      await writeFile(marker, JSON.stringify({ completedAt: new Date().toISOString(), records: plan.length, backup: backupName }, null, 2), { flag: 'wx' });
      console.log('Editorial changes saved. Unrelated fields, identifiers, relationships, media, and publication states verified unchanged.');
    }
  }
} catch (error) {
  console.error(['MongoServerError', 'MongoNetworkError', 'MongooseServerSelectionError'].includes(error.name) ? 'The database revision could not complete.' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
