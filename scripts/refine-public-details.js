import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { readConfig } from '../src/config.js';
import { Page } from '../src/models.js';

// One targeted saved-copy change, outside nodemon's watched src directory.
// Preview by default; --apply saves with a backup and concurrency protection.
const revision = 'public-details-2026-09-23';
const archive = new URL('../.content-revisions/', import.meta.url);
const marker = new URL(`${revision}.complete.json`, archive);
const intro = 'The first three scents in the Dagger & Bone collection.';
const config = readConfig();

function otherFields(record) {
  const value = JSON.parse(JSON.stringify(record));
  delete value.intro;
  delete value.updatedAt;
  return value;
}

try {
  const complete = await readFile(marker, 'utf8').then(() => true).catch(error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  if (complete) {
    console.log('This revision is already complete; no content changed.');
  } else {
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, autoIndex: false, autoCreate: false });
    const before = await Page.findOne({ key: 'scents' }).lean();
    if (!before) throw new Error('The existing scent-guide page was not found.');
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ page: 'scents', field: 'intro', before: before.intro, after: intro, changed: before.intro !== intro }));
      console.log('Preview only. No records changed.');
    } else {
      await mkdir(archive, { recursive: true });
      await writeFile(new URL('.gitignore', archive), '*\n!.gitignore\n');
      const backup = `${revision}-${Date.now()}.json`;
      await writeFile(new URL(backup, archive), JSON.stringify({ before, update: { intro } }, null, 2), { flag: 'wx' });
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const result = await Page.updateOne({ _id: before._id, updatedAt: before.updatedAt }, { $set: { intro } }, { session, runValidators: true });
          if (result.matchedCount !== 1) throw new Error('Content changed concurrently; the revision was rolled back.');
          const after = await Page.findById(before._id).session(session).lean();
          if (after.intro !== intro || !isDeepStrictEqual(otherFields(before), otherFields(after))) throw new Error('Content verification failed; the revision was rolled back.');
        });
      } finally { await session.endSession(); }
      await writeFile(marker, JSON.stringify({ completedAt: new Date().toISOString(), records: 1, field: 'intro', backup }, null, 2), { flag: 'wx' });
      console.log('Saved the scent-guide introduction. All other fields verified unchanged.');
    }
  }
} catch (error) {
  console.error(['MongoServerError', 'MongoNetworkError', 'MongooseServerSelectionError'].includes(error.name) ? 'The database revision could not complete.' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
