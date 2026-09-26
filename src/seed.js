import 'dotenv/config';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readConfig } from './config.js';
import { FAQ, Page, Product, Reward, Scent, Settings } from './models.js';

// Initial content only. Owner edits remain authoritative; editorial revisions
// update existing records separately through the field-level CMS workflow.
const settings = {
  "brandName": "Dagger & Bone Apothecary",
  "tagline": "Grooming with custom scents and a sense of humor.",
  "kickstarterUrl": "https://www.kickstarter.com/projects/daggerandbone/dagger-and-bone-apothecary-mens-hair-skin-and-body-care",
  "kickstarterLaunchDate": "2026-10-15",
  "canonicalUrl": ""
};
const scents = [
  {
    "name": "Mordant",
    "slug": "mordant",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Mordant Scent | Dagger & Bone Apothecary",
      "description": "Mordant is the scent planned for shampoo, conditioner and bar soap in the first Dagger & Bone Apothecary collection."
    }
  },
  {
    "name": "Cordovan",
    "slug": "cordovan",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Cordovan Scent | Dagger & Bone Apothecary",
      "description": "Cordovan is the scent planned for body wash, hand lotion and body lotion in the first Dagger & Bone Apothecary collection."
    }
  },
  {
    "name": "Flint",
    "slug": "flint",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Flint Scent | Dagger & Bone Apothecary",
      "description": "Flint is the scent planned for cologne in the first Dagger & Bone Apothecary collection."
    }
  }
];
const products = [
  {
    "name": "Mordant Shampoo",
    "slug": "mordant-shampoo",
    "kind": "shampoo",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Mordant Shampoo | Dagger & Bone Apothecary",
      "description": "Mordant Shampoo is in development for Dagger & Bone Apothecary's first collection of men's hair, skin, and body care."
    },
    "scent": "mordant"
  },
  {
    "name": "Mordant Conditioner",
    "slug": "mordant-conditioner",
    "kind": "conditioner",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Mordant Conditioner | Dagger & Bone Apothecary",
      "description": "Mordant Conditioner is in development for Dagger & Bone Apothecary's first collection of men's hair, skin, and body care."
    },
    "scent": "mordant"
  },
  {
    "name": "Mordant Bar Soap",
    "slug": "mordant-bar-soap",
    "kind": "bar soap",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Mordant Bar Soap | Dagger & Bone Apothecary",
      "description": "Mordant Bar Soap is in development for Dagger & Bone Apothecary's first collection of men's hair, skin, and body care."
    },
    "scent": "mordant"
  },
  {
    "name": "Cordovan Body Wash",
    "slug": "cordovan-body-wash",
    "kind": "body wash",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Cordovan Body Wash | Dagger & Bone Apothecary",
      "description": "Cordovan Body Wash is in development for Dagger & Bone Apothecary's first collection of men's hair, skin, and body care."
    },
    "scent": "cordovan"
  },
  {
    "name": "Cordovan Hand Lotion",
    "slug": "cordovan-hand-lotion",
    "kind": "hand lotion",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Cordovan Hand Lotion | Dagger & Bone Apothecary",
      "description": "Cordovan Hand Lotion is in development for Dagger & Bone Apothecary's first collection of men's hair, skin, and body care."
    },
    "scent": "cordovan"
  },
  {
    "name": "Cordovan Body Lotion",
    "slug": "cordovan-body-lotion",
    "kind": "body lotion",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Cordovan Body Lotion | Dagger & Bone Apothecary",
      "description": "Cordovan Body Lotion is in development for Dagger & Bone Apothecary's first collection of men's hair, skin, and body care."
    },
    "scent": "cordovan"
  },
  {
    "name": "Flint Cologne",
    "slug": "flint-cologne",
    "kind": "cologne",
    "summary": "",
    "body": "",
    "seo": {
      "title": "Flint Cologne | Dagger & Bone Apothecary",
      "description": "Flint Cologne is in development for Dagger & Bone Apothecary's first collection of men's hair, skin, and body care."
    },
    "scent": "flint"
  }
];
const pages = [
  {
    "key": "home",
    "slug": "/",
    "eyebrow": "Dagger & Bone Apothecary",
    "title": "Your masculinity isn't water-soluble.",
    "intro": "Men's hair, skin, and body care. Three custom scents. Our first collection is in development.",
    "body": "",
    "seo": {
      "title": "Dagger & Bone Apothecary | Men's Hair, Skin & Body Care",
      "description": "Explore Dagger & Bone Apothecary's seven planned grooming products, three custom scents, and Kickstarter founding rewards."
    }
  },
  {
    "key": "products",
    "slug": "/products",
    "eyebrow": "THE FIRST COLLECTION",
    "title": "Hair. Skin. Body.",
    "intro": "We're developing seven products across three custom scents.",
    "body": "In development",
    "seo": {
      "title": "The Collection | Dagger & Bone Apothecary",
      "description": "Explore the first Dagger & Bone collection: Mordant shampoo, conditioner and bar soap; Cordovan body wash and lotions; and Flint cologne. All are in development."
    }
  },
  {
    "key": "scents",
    "slug": "/scents",
    "eyebrow": "",
    "title": "Find your scent",
    "intro": "Cordovan, Mordant, and Flint are the three custom scents in our first collection.",
    "body": "",
    "seo": {
      "title": "Scent Guide | Dagger & Bone Apothecary",
      "description": "Meet Cordovan, Mordant, and Flint, the three custom scents in the first Dagger & Bone Apothecary collection, and see their associated products."
    }
  },
  {
    "key": "about",
    "slug": "/about",
    "eyebrow": "",
    "title": "Taking care of yourself shouldn't require a personality change.",
    "intro": "We're Dagger & Bone Apothecary, a men's hair, skin, and body-care brand based in St. Augustine, Florida. Josh, our founder, is developing our first collection.",
    "body": "We think grooming should leave you free to be yourself. Taking care of your hair and skin, or choosing a scent you like, shouldn't come with a lecture about what makes you a man.\n\nNobody needs to prove anything to a bottle of conditioner.",
    "seo": {
      "title": "About | Dagger & Bone Apothecary",
      "description": "Meet Dagger & Bone Apothecary, the St. Augustine, Florida brand developing men's grooming products with custom scents and an irreverent sense of humor."
    }
  },
  {
    "key": "kickstarter",
    "slug": "/kickstarter",
    "eyebrow": "",
    "title": "Kickstarter & founding rewards",
    "intro": "We're preparing a Kickstarter campaign to support our first collection of men's hair, skin, and body care.",
    "body": "Follow the prelaunch page on Kickstarter to get notified when the campaign opens. The date below is for the campaign launch; it is not a product delivery estimate.",
    "seo": {
      "title": "Kickstarter & Founding Rewards | Dagger & Bone Apothecary",
      "description": "Follow the Dagger & Bone Apothecary Kickstarter launch and explore a founding reward that lets backers help create and name a limited-edition soap."
    }
  },
  {
    "key": "contact",
    "slug": "/contact",
    "eyebrow": "",
    "title": "Talk to Dagger & Bone.",
    "intro": "Have a question, a press inquiry, or a collaboration idea? Send us a message.",
    "body": "",
    "seo": {
      "title": "Contact | Dagger & Bone Apothecary",
      "description": "Send Dagger & Bone Apothecary a question, press inquiry, or collaboration idea using the contact form."
    }
  },
  {
    "key": "faq",
    "slug": "/faq",
    "eyebrow": "",
    "title": "A few straight answers.",
    "intro": "The first collection is in development and isn't available to buy yet.",
    "body": "",
    "seo": {
      "title": "FAQ | Dagger & Bone Apothecary",
      "description": "Find answers about the first Dagger & Bone collection, product availability, the Kickstarter launch, and the limited-edition soap reward."
    }
  },
  {
    "key": "signup",
    "slug": "/signup",
    "eyebrow": "",
    "title": "Get the launch email.",
    "intro": "We'll email you when the Kickstarter launches and occasionally share news about the collection.",
    "body": "This subscribes you to Dagger & Bone Apothecary emails. It does not follow the campaign on Kickstarter.",
    "seo": {
      "title": "Email updates | Dagger & Bone Apothecary",
      "description": "Subscribe to Dagger & Bone emails for the Kickstarter launch and occasional collection news."
    }
  }
];
const rewards = [
  {
    "title": "Create and name a limited-edition soap",
    "slug": "create-a-soap",
    "summary": "",
    "body": "This is a founding reward for Kickstarter backers. Each edition contains six bars: one for its creator and five offered for sale.",
    "order": 1,
    "seo": {
      "title": "Create a Soap: Founding Reward | Dagger & Bone Apothecary",
      "description": "Help create and name a limited-edition soap. Each edition has six bars: one for its creator and five offered for sale."
    }
  }
];
const faqs = [
  {
    "question": "Are the products available to buy?",
    "answer": "Not yet. The first seven products are in development.",
    "order": 1
  },
  {
    "question": "When does the Kickstarter launch?",
    "answer": "The planned campaign launch date is shown above. Follow the prelaunch page on Kickstarter to get notified when it opens. The campaign launch is separate from product delivery.",
    "order": 2
  },
  {
    "question": "Which scents are in the first collection?",
    "answer": "Cordovan is planned for body wash, hand lotion, and body lotion. Mordant is planned for shampoo, conditioner, and bar soap, and Flint for cologne. These are the first three scents; the collection isn't limited to them.",
    "order": 3
  },
  {
    "question": "How does the founding soap reward work?",
    "answer": "A backer who selects this founding reward helps create and name a limited-edition soap. Each edition contains six bars: one for its creator and five offered for sale.",
    "order": 4
  }
];

export async function seedDatabase() {
  await Settings.updateOne({ key: 'main' }, { $setOnInsert: settings }, { upsert: true });
  for (const scent of scents) await Scent.updateOne({ slug: scent.slug }, { $setOnInsert: { ...scent, status: 'published' } }, { upsert: true });
  const scentIds = Object.fromEntries((await Scent.find({ slug: { $in: scents.map(item => item.slug) } }).select('_id slug').lean()).map(item => [item.slug, item._id]));
  for (const product of products) await Product.updateOne({ slug: product.slug }, { $setOnInsert: { ...product, scent: scentIds[product.scent], status: 'published' } }, { upsert: true });
  for (const page of pages) await Page.updateOne({ key: page.key }, { $setOnInsert: { ...page, status: 'published' } }, { upsert: true });
  for (const reward of rewards) await Reward.updateOne({ slug: reward.slug }, { $setOnInsert: { ...reward, status: 'published' } }, { upsert: true });
  // A CMS rewrite of a seeded question must not create a duplicate at startup.
  for (const faq of faqs) await FAQ.updateOne({ $or: [{ question: faq.question }, { order: faq.order }] }, { $setOnInsert: { ...faq, status: 'published' } }, { upsert: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = readConfig();
  if (!config.mongoUri) throw new Error('MONGODB_URI is required');
  try {
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, serverSelectionTimeoutMS: 10000 });
    await seedDatabase();
    console.log('Seed complete. Existing content was preserved.');
  } finally { await mongoose.disconnect(); }
}
