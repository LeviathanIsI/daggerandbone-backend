import test from 'node:test';
import assert from 'node:assert/strict';
import { Page } from '../src/models.js';
import { cleanLegacyAboutIntro } from '../src/seed.js';

test('startup corrects only the obsolete About intro and preserves other CMS edits', async () => {
  const originalFind = Page.findOne;
  const originalUpdate = Page.updateOne;
  const updates = [];
  let stored = { _id: 'about-id', intro: "We're Dagger & Bone Apothecary, based in St. Augustine. Josh, our founder, is developing our first collection." };
  Page.findOne = () => ({ select: () => ({ lean: async () => stored }) });
  Page.updateOne = async (...args) => { updates.push(args); return { matchedCount: 1 }; };
  try {
    await cleanLegacyAboutIntro();
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0][0], { _id: stored._id, intro: stored.intro });
    assert.equal(updates[0][1].$set.intro, "We're Dagger & Bone Apothecary, based in St. Augustine. Our first collection is in development.");
    stored = { _id: 'about-id', intro: 'Owner-edited brand introduction.' };
    await cleanLegacyAboutIntro();
    assert.equal(updates.length, 1);
  } finally {
    Page.findOne = originalFind;
    Page.updateOne = originalUpdate;
  }
});
