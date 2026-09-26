import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { readConfig } from '../src/config.js';
import { Page, Product, Scent, Reward, FAQ, Settings } from '../src/models.js';

// Targeted CMS revision, using the existing preview / transaction / completion workflow.
// No application listener, reseeding, private records, or integration calls.
const revision = 'public-editorial-2026-09-25';
const directory = new URL('../.content-revisions/', import.meta.url);
const marker = new URL(`${revision}.complete.json`, directory);
const models = { Page, Product, Scent, Reward, FAQ, Settings };
const targets = JSON.parse(await readFile(new URL('./editorial-cleanup-2026-09-25.json', import.meta.url), 'utf8'));
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
  if (completed) console.log('Revision already completed. Later CMS edits were left intact.');
  else {
    const config = readConfig();
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const edits = [];
    for (const target of targets) {
      const Model = models[target.type];
      const before = await Model.findOne(target.filter).lean();
      if (!before || !isDeepStrictEqual(Object.fromEntries(Object.keys(target.expected).map(key => [key, before[key]])), target.expected)) throw new Error(`The reviewed ${target.type} copy changed or is missing; review again before applying. No changes saved.`);
      if (!isDeepStrictEqual(Object.fromEntries(Object.keys(target.changes).map(key => [key, before[key]])), target.changes)) edits.push({ Model, before, changes: target.changes });
    }
    console.log(JSON.stringify(edits.map(({ Model, before, changes }) => ({ type: Model.modelName, record: before.key || before.slug || before.question, fields: Object.keys(changes) })), null, 2));
    if (!process.argv.includes('--apply')) console.log('Preview only. No records changed.');
    else {
      await mkdir(directory, { recursive: true });
      const audit = `${revision}-${Date.now()}.json`;
      await writeFile(new URL(audit, directory), JSON.stringify(edits.map(({ Model, before, changes }) => ({ type: Model.modelName, id: before._id, before: Object.fromEntries(Object.keys(changes).map(key => [key, before[key]])), after: changes })), null, 2), { flag: 'wx' });
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          for (const { Model, before, changes } of edits) {
            const result = await Model.updateOne({ _id: before._id, updatedAt: before.updatedAt }, { $set: changes }, { session, runValidators: true });
            if (result.matchedCount !== 1) throw new Error('A concurrent CMS edit was detected. The transaction was rolled back.');
            const after = await Model.findById(before._id).session(session).lean();
            if (!isDeepStrictEqual(untouched(before, changes), untouched(after, changes)) || !isDeepStrictEqual(Object.fromEntries(Object.keys(changes).map(key => [key, after[key]])), changes)) throw new Error('Content preservation check failed. The transaction was rolled back.');
          }
        });
      } finally { await session.endSession(); }
      await writeFile(marker, JSON.stringify({ completedAt: new Date().toISOString(), updated: edits.length, audit }, null, 2), { flag: 'wx' });
      console.log(`Saved ${edits.length} public records. All unrelated fields verified unchanged.`);
    }
  }
} catch (error) {
  console.error(['MongoServerError', 'MongoNetworkError', 'MongooseServerSelectionError'].includes(error.name) ? 'CMS revision failed; no connection details are printed.' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
