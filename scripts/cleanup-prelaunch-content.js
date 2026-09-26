import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { readConfig } from '../src/config.js';
import { Page, Settings, FAQ } from '../src/models.js';

// Existing field-level editorial revision workflow. Preview unless --apply is supplied.
// This script is outside nodemon's watched src directory and never starts a server.
const revision = 'prelaunch-cleanup-2026-09-25';
const auditDirectory = new URL('../.content-revisions/', import.meta.url);
const marker = new URL(`${revision}.complete.json`, auditDirectory);
const targets = [
  [Settings, { key: 'main' }, { tagline: "Men's grooming. Custom scents. An irreverent attitude." }],
  [Page, { key: 'home' }, { intro: "Men's hair, skin, and body care. Three custom scents. Our first collection is in development." }],
  [Page, { key: 'about' }, {
    intro: "Dagger & Bone Apothecary is a men's grooming brand based in St. Augustine, Florida. Founder Josh is developing the first collection around custom scents and a straightforward approach to looking after yourself.",
    body: "Somewhere along the way, men's grooming turned into another test of masculinity. We're making hair, skin, and body care.\n\nNobody needs to prove anything to a bottle of conditioner.",
  }],
  [Page, { key: 'contact' }, { intro: 'Questions, press, or collaboration ideas? Send a message.', body: '' }],
  [FAQ, { _id: '6ab425ed6b04533034c5ff8d' }, { answer: 'Not yet. The first seven products are in development.' }],
  [FAQ, { _id: '6ab425ed6b04533034c5ff8e' }, { answer: 'The campaign launch is separate from product delivery. Follow the prelaunch page on Kickstarter to get notified when the campaign goes live.' }],
  [FAQ, { _id: '6ab425ed6b04533034c5ff8f' }, {
    question: 'Which scents are in the first collection?',
    answer: "Cordovan: body wash, hand lotion, and body lotion. Mordant: shampoo, conditioner, and bar soap. Flint: cologne. These are the opening scents; the collection isn't limited to them.",
  }],
];
// Give the existing signup route/footer copy the existing Page editor as its source.
// No new schema, duplicate variant records, private settings, or integration changes.
const signup = {
  key: 'signup', slug: '/signup', title: 'Get the launch email.', eyebrow: '',
  intro: "We'll email you when the Kickstarter launches, plus occasional collection news.",
  body: 'These are Dagger & Bone emails. Signing up here does not follow the campaign on Kickstarter.',
  status: 'published',
  seo: { title: 'Email updates | Dagger & Bone Apothecary', description: 'Subscribe to Dagger & Bone emails for the Kickstarter launch and occasional collection news.' },
};

function untouched(record, changes) {
  const value = JSON.parse(JSON.stringify(record));
  for (const key of [...Object.keys(changes), 'updatedAt']) delete value[key];
  return value;
}

try {
  const completed = await readFile(marker, 'utf8').then(() => true).catch(error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  if (completed) {
    console.log('Revision already completed. Later CMS edits were left intact.');
  } else {
    const config = readConfig();
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const edits = [];
    for (const [Model, filter, changes] of targets) {
      const before = await Model.findOne(filter).lean();
      if (!before) throw new Error(`Missing expected ${Model.modelName} record; no changes saved.`);
      if (Object.entries(changes).some(([key, value]) => before[key] !== value)) edits.push({ Model, before, changes });
    }
    const existingSignup = await Page.findOne({ $or: [{ key: 'signup' }, { slug: '/signup' }] }).lean();
    // Never overwrite an existing, separately authored subscription page.
    if (existingSignup) console.log('Existing signup page retained for editorial review.');
    const privacy = await Page.find({ $or: [{ key: /privacy/i }, { slug: /privacy/i }, { title: /privacy/i }] }).select('key slug title status').lean();
    console.log(JSON.stringify({ edits: edits.map(({ Model, before, changes }) => ({ type: Model.modelName, record: before.key || before.question, fields: Object.keys(changes) })), createSignupPage: !existingSignup, privacyPages: privacy }, null, 2));
    if (!process.argv.includes('--apply')) console.log('Preview only. No records changed.');
    else {
      await mkdir(auditDirectory, { recursive: true });
      // Only changed public fields are recorded. This is not an application archive.
      const audit = `${revision}-${Date.now()}.json`;
      await writeFile(new URL(audit, auditDirectory), JSON.stringify({ edits: edits.map(({ Model, before, changes }) => ({ type: Model.modelName, id: before._id, before: Object.fromEntries(Object.keys(changes).map(key => [key, before[key]])), after: changes })), signup: existingSignup ? null : signup }, null, 2), { flag: 'wx' });
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          for (const { Model, before, changes } of edits) {
            const result = await Model.updateOne({ _id: before._id, updatedAt: before.updatedAt }, { $set: changes }, { session, runValidators: true });
            if (result.matchedCount !== 1) throw new Error('A CMS edit arrived concurrently; all changes were rolled back.');
            const after = await Model.findById(before._id).session(session).lean();
            if (!isDeepStrictEqual(untouched(before, changes), untouched(after, changes)) || Object.entries(changes).some(([key, value]) => after[key] !== value)) throw new Error('Field preservation check failed; all changes were rolled back.');
          }
          if (!existingSignup) await Page.create([signup], { session });
        });
      } finally { await session.endSession(); }
      await writeFile(marker, JSON.stringify({ completedAt: new Date().toISOString(), updated: edits.length, createdSignup: !existingSignup, audit }, null, 2), { flag: 'wx' });
      console.log(`Saved ${edits.length} targeted public records${existingSignup ? '' : ' and the signup page'}. Unrelated fields verified unchanged.`);
    }
  }
} catch (error) {
  console.error(['MongoServerError', 'MongoNetworkError', 'MongooseServerSelectionError'].includes(error.name) ? 'CMS revision failed; inspect the database connection locally.' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
