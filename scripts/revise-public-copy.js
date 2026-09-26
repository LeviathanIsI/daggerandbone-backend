import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FAQ, Page, Product, Reward, Scent, Settings } from '../src/models.js';

// A one-time, field-level editorial revision. It never seeds, publishes, or
// changes identifiers, relationships, media assets, accounts, or integrations.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const revision = 'public-copy-2026-09-23';
const archive = new URL('../.content-revisions/', import.meta.url);
const marker = new URL(`${revision}.complete.json`, archive);
const brand = 'Dagger & Bone Apothecary';
const aboutBody = [
  "Somewhere along the way, men's grooming turned into another test of masculinity. We're making hair, skin, and body care. Nobody needs to prove anything to a bottle of conditioner.",
  "Dagger & Bone Apothecary brings custom scents and an irreverent attitude to the everyday business of getting clean and looking after yourself. The old-world apothecary influence belongs in the artwork and packaging. The routine should be straightforward.",
  'Our first collection pairs Mordant with shampoo, conditioner, and bar soap; Cordovan with body wash and lotions; and Flint with cologne.',
  "We're developing the first collection now. Follow the Kickstarter launch to see what's coming and explore the founding rewards."
].join('\n\n');

const pages = [
  ['home', {
    title: 'Hair, skin & body care. Leave the ego out of it.',
    eyebrow: brand,
    intro: "Custom scents, botanical packaging, and a straightforward approach to men's grooming. We're developing the first collection now.",
    body: 'Seven planned products for hair, skin, and body, with custom scents connecting the range.',
    'seo.title': `${brand} | Men's Hair, Skin & Body Care`,
    'seo.description': "Men's grooming with custom scents and an irreverent attitude. Meet the seven planned Dagger & Bone Apothecary products and follow the Kickstarter launch."
  }],
  ['products', {
    title: 'The collection', eyebrow: '',
    intro: 'Seven planned products, from the hair pair to cologne. Mordant, Cordovan, and Flint are the opening scents.',
    body: "The first collection is in development and isn't available to buy yet. Follow the Kickstarter launch for campaign and reward details.",
    'seo.title': `The Collection | ${brand}`,
    'seo.description': 'Meet the seven planned products: Mordant shampoo, conditioner and bar soap; Cordovan body wash, hand and body lotions; and Flint cologne.'
  }],
  ['scents', {
    title: 'Find your scent', eyebrow: '',
    intro: 'Compare the planned products for Mordant, Cordovan, and Flint.',
    body: 'Pick a wash format, find the matching care products, or go straight to cologne.',
    'seo.title': `Find Your Scent | ${brand}`,
    'seo.description': 'Find the planned shampoo, conditioner, soap, body wash, lotions and cologne connected to Mordant, Cordovan and Flint, the opening Dagger & Bone Apothecary scents.'
  }],
  ['about', {
    title: "Taking care of yourself shouldn't require a personality change.",
    eyebrow: '', intro: '', body: aboutBody,
    'seo.title': `About | ${brand}`,
    'seo.description': "Men's grooming doesn't need a masculinity test. Dagger & Bone Apothecary brings custom scents and an irreverent attitude to hair, skin and body care."
  }],
  ['kickstarter', {
    title: 'Kickstarter & founding rewards', eyebrow: '',
    intro: 'Seven planned products. Three opening scents. A chance to help create a soap of your own.',
    body: "The campaign brings Dagger & Bone Apothecary's hair, skin, and body care range together in one launch. Follow on Kickstarter for campaign updates and the full reward details.",
    'seo.title': `Kickstarter & Founding Rewards | ${brand}`,
    'seo.description': 'Follow the Dagger & Bone Apothecary Kickstarter launch and explore a founding reward that lets backers help create and name a limited-edition soap.'
  }],
  ['contact', {
    title: 'Talk to Dagger & Bone.', eyebrow: '',
    intro: 'Questions about the collection or Kickstarter? Send them here.',
    body: "If you're asking about a product or reward, include its name so we can get straight to it.",
    'seo.title': `Contact | ${brand}`,
    'seo.description': 'Contact Dagger & Bone Apothecary with questions about the collection, scents or Kickstarter founding rewards.'
  }],
  ['faq', {
    title: 'A few straight answers.', eyebrow: '',
    intro: 'Buying, scents, and the Kickstarter launch.', body: '',
    'seo.title': `FAQ | ${brand}`,
    'seo.description': 'Answers about product availability, the opening scents, the Kickstarter launch and the limited-edition soap reward from Dagger & Bone Apothecary.'
  }]
];

const products = [
  ['mordant-shampoo', 'Mordant Shampoo',
    'One half of the Mordant hair pair, with a separate conditioner planned in the same scent.',
    'Shampoo and conditioner get separate places in the collection. Mordant also extends to bar soap, linking hair care and soap through the same custom scent.',
    'Meet the shampoo in the planned Mordant range, alongside a separate conditioner and bar soap from Dagger & Bone Apothecary.'],
  ['mordant-conditioner', 'Mordant Conditioner',
    'The companion to Mordant Shampoo, for a hair routine built around the same scent.',
    "Conditioner doesn't need a masculinity disclaimer. It sits beside shampoo in the Mordant range, with bar soap carrying the same scent into another part of the collection.",
    'Meet the planned companion to Mordant Shampoo. Mordant Conditioner shares its scent with the shampoo and bar soap in the opening collection.'],
  ['mordant-bar-soap', 'Mordant Bar Soap',
    "Mordant's bar format, alongside shampoo and conditioner in the same scent.",
    'The opening collection includes both bar soap and body wash. Mordant is the bar soap choice; Cordovan is planned for body wash. Compare the formats and scents that interest you.',
    'Explore the planned Mordant Bar Soap and its place beside Mordant shampoo and conditioner in the Dagger & Bone Apothecary range.'],
  ['cordovan-body-wash', 'Cordovan Body Wash',
    'The wash in a three-product Cordovan range, with hand and body lotions alongside it.',
    'Cordovan connects body wash, hand lotion, and body lotion through one custom scent. For a bar format, the opening collection also includes Mordant Bar Soap.',
    'Explore the planned Cordovan Body Wash, paired by scent with Cordovan hand lotion and body lotion from Dagger & Bone Apothecary.'],
  ['cordovan-hand-lotion', 'Cordovan Hand Lotion',
    'A dedicated hand-care product beside Cordovan Body Lotion, with both planned in the same scent.',
    "Looking after your hands doesn't call for a justification. Cordovan groups hand lotion with body lotion and body wash, all under the same scent.",
    'Meet the hand lotion in the planned Cordovan range, alongside a separate body lotion and body wash from Dagger & Bone Apothecary.'],
  ['cordovan-body-lotion', 'Cordovan Body Lotion',
    "The body-care counterpart to Cordovan Hand Lotion, sharing a scent with the range's body wash.",
    "Body lotion belongs in a men's grooming lineup as readily as shampoo or soap. Cordovan groups it with a separate hand lotion and body wash.",
    'Explore the planned Cordovan Body Lotion and its relationship to Cordovan hand lotion and body wash in the opening Dagger & Bone Apothecary range.'],
  ['flint-cologne', 'Flint Cologne',
    "The opening collection's standalone fragrance, bringing Flint into the range as a cologne.",
    'Flint has a single role in the opening range: cologne. Mordant and Cordovan connect several wash and care products; Flint is the fragrance choice.',
    'Meet Flint, the cologne planned for the opening Dagger & Bone Apothecary collection, alongside the Mordant and Cordovan grooming ranges.']
];

// No verified fragrance notes exist in the inspected scent records. Their
// product relationships remain visible; empty descriptions leave room for facts.
const scents = [
  ['mordant', 'Mordant', 'Mordant is the scent planned for shampoo, conditioner and bar soap in the opening Dagger & Bone Apothecary collection.'],
  ['cordovan', 'Cordovan', 'Cordovan is the scent planned for body wash, hand lotion and body lotion in the opening Dagger & Bone Apothecary collection.'],
  ['flint', 'Flint', 'Flint is the scent planned for cologne in the opening Dagger & Bone Apothecary collection.']
];
const faqs = [
  ['Are the products available to buy?', "Not yet. We're developing the first seven products. Follow the Kickstarter campaign for the launch and founding rewards."],
  ['When does the Kickstarter launch?', 'The Kickstarter page shows the current launch date and links to the campaign. Follow there for launch updates.'],
  ['Are Mordant, Cordovan, and Flint the only scents?', "They're the opening three. Mordant covers shampoo, conditioner, and bar soap; Cordovan covers body wash and lotions; Flint is the cologne. The range isn't limited to those scents."],
  ['How does the founding soap reward work?', 'You help create and name a limited-edition soap. Each edition contains six bars: one for its creator and five offered for sale.']
];

const specifications = [
  ...pages.map(([key, fields]) => ({ Model: Page, query: { key }, label: `page:${key}`, fields })),
  ...products.map(([slug, name, summary, body, description]) => ({ Model: Product, query: { slug }, label: `product:${slug}`, fields: { summary, body, 'seo.title': `${name} | ${brand}`, 'seo.description': description } })),
  ...scents.map(([slug, name, description]) => ({ Model: Scent, query: { slug }, label: `scent:${slug}`, fields: { summary: '', body: '', 'seo.title': `${name} Scent | ${brand}`, 'seo.description': description } })),
  ...faqs.map(([question, answer]) => ({ Model: FAQ, query: { question }, label: `faq:${question}`, fields: { answer } })),
  { Model: Reward, query: { slug: 'create-a-soap' }, label: 'reward:create-a-soap', fields: {
    title: 'Create and name a limited-edition soap',
    summary: 'A founding reward for backers who want a hand in the product itself.',
    body: 'Each edition contains six bars: one for its creator and five offered for sale.',
    'seo.title': `Create a Soap: Founding Reward | ${brand}`,
    'seo.description': 'Help create and name a limited-edition soap. Each edition has six bars: one for its creator and five offered for sale.'
  } },
  { Model: Settings, query: { key: 'main' }, label: 'brand settings', fields: {
    brandName: brand,
    tagline: "Men's hair, skin, and body care. Custom scents. No masculinity test."
  } }
];

function valueAt(record, path) { return path.split('.').reduce((value, part) => value?.[part], record); }
function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function withoutChanges(record, fields) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.updatedAt;
  for (const path of Object.keys(fields)) {
    const keys = path.split('.');
    const key = keys.pop();
    const parent = keys.reduce((value, part) => value?.[part], copy);
    if (parent) delete parent[key];
  }
  return copy;
}

try {
  const apply = process.argv.includes('--apply');
  if (apply) {
    try {
      await readFile(marker);
      console.log('This revision was already applied. Subsequent admin edits will not be overwritten.');
      process.exit(0);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME, autoIndex: false, serverSelectionTimeoutMS: 12000 });
  const plan = [];
  for (const spec of specifications) {
    const records = await spec.Model.find(spec.query).lean();
    if (records.length !== 1) throw new Error(`Expected one record for ${spec.label}; found ${records.length}`);
    const before = records[0];
    const fields = Object.fromEntries(Object.entries(spec.fields).filter(([path, value]) => !equal(valueAt(before, path), value)));
    const candidate = spec.Model.hydrate(before);
    for (const [path, value] of Object.entries(fields)) candidate.set(path, value);
    await candidate.validate();
    if (Object.keys(fields).length) plan.push({ ...spec, before, fields });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', records: plan.map(({label, fields}) => ({label, fields: Object.keys(fields)})) }, null, 2));
  if (apply && plan.length) {
    await mkdir(archive, { recursive: true });
    await writeFile(new URL('.gitignore', archive), '*\n');
    const backup = new URL(`${revision}-${Date.now()}.json`, archive);
    await writeFile(backup, JSON.stringify({ revision, createdAt: new Date().toISOString(), records: plan.map(({label, Model, before, fields}) => ({label, collection: Model.collection.name, before, fields})) }, null, 2), { flag: 'wx' });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const { Model, before, fields, label } of plan) {
          const result = await Model.updateOne({ _id: before._id, updatedAt: before.updatedAt }, { $set: fields }, { runValidators: true, session });
          if (result.matchedCount !== 1) throw new Error(`Concurrent change detected for ${label}; revision rolled back`);
        }
      });
    } finally { await session.endSession(); }
    for (const { Model, before, fields, label } of plan) {
      const after = await Model.findById(before._id).lean();
      if (Object.entries(fields).some(([path, value]) => !equal(valueAt(after, path), value))) throw new Error(`Copy verification failed for ${label}`);
      if (!equal(withoutChanges(before, fields), withoutChanges(after, fields))) throw new Error(`Unrelated field changed for ${label}`);
    }
    await writeFile(marker, JSON.stringify({ revision, appliedAt: new Date().toISOString(), records: plan.length, backup: fileURLToPath(backup) }, null, 2), { flag: 'wx' });
    console.log(`Applied and verified ${plan.length} content records. All unrelated fields were preserved.`);
  }
} catch (error) {
  // Never print driver errors that could contain connection configuration.
  console.error(error.name === 'Error' ? error.message : `Copy revision failed (${error.name}).`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
