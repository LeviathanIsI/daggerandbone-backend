import { z } from 'zod';

const text = (max) => z.string().trim().max(max);
const requiredText = (max) => text(max).min(1);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const httpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), 'Must be an HTTP URL');
export const email = z.string().trim().toLowerCase().email().max(254);
export const media = z.object({
  url: httpUrl,
  publicId: text(300).optional().default(''),
  alt: text(250).optional().default(''),
  caption: text(500).optional().default(''),
  order: z.coerce.number().int().min(0).max(10000).optional().default(0),
  width: z.coerce.number().int().min(0).optional(),
  height: z.coerce.number().int().min(0).optional()
});
const seo = z.object({ title: text(90).optional().default(''), description: text(200).optional().default('') });
const status = z.enum(['draft', 'published']);
const images = z.array(media).max(30).optional().default([]);

export const contentSchemas = {
  scents: z.object({ name: requiredText(100), slug, summary: text(500).optional().default(''), body: text(10000).optional().default(''), images, status: status.optional().default('draft'), seo: seo.optional().default({}) }),
  products: z.object({ name: requiredText(120), slug, kind: requiredText(100), summary: text(500).optional().default(''), body: text(10000).optional().default(''), scent: objectId, images, status: status.optional().default('draft'), seo: seo.optional().default({}) }),
  pages: z.object({ key: slug, slug: z.string().trim().toLowerCase().max(120), title: requiredText(160), eyebrow: text(100).optional().default(''), intro: text(1000).optional().default(''), body: text(15000).optional().default(''), sections: z.array(z.object({ heading: text(160), body: text(5000) })).max(20).optional().default([]), images, status: status.optional().default('draft'), seo: seo.optional().default({}) }),
  rewards: z.object({ title: requiredText(160), slug, summary: text(500).optional().default(''), body: text(5000).optional().default(''), order: z.coerce.number().int().min(0).max(10000).optional().default(0), status: status.optional().default('draft'), seo: seo.optional().default({}) }),
  faqs: z.object({ question: requiredText(300), answer: requiredText(5000), order: z.coerce.number().int().min(0).max(10000).optional().default(0), status: status.optional().default('draft') })
};

export const settingsSchema = z.object({
  brandName: requiredText(160),
  tagline: text(300).optional().default(''),
  kickstarterUrl: httpUrl.or(z.literal('')).optional().default(''),
  kickstarterLaunchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  logo: media.nullable().optional().default(null),
  favicon: media.nullable().optional().default(null),
  homeImage: media.nullable().optional().default(null),
  canonicalUrl: httpUrl.or(z.literal('')).optional().default('')
});

const publicEmail = z.string({ required_error: 'Enter your email address.', invalid_type_error: 'Enter a valid email address.' }).trim().toLowerCase().email('Enter a valid email address.').max(254, 'Use an email address with no more than 254 characters.');
export const contactSchema = z.object({
  name: z.string({ required_error: 'Enter your name.', invalid_type_error: 'Enter your name.' }).trim().min(1, 'Enter your name.').max(120, 'Keep your name to 120 characters or fewer.'),
  email: publicEmail,
  message: z.string({ required_error: 'Enter a message.', invalid_type_error: 'Enter a message.' }).trim().min(10, 'Write a message with at least 10 characters.').max(5000, 'Keep your message to 5,000 characters or fewer.'),
  website: text(200).optional().default(''),
});
export const subscribeSchema = z.object({ email: publicEmail, consent: z.literal(true, { errorMap: () => ({ message: 'Please agree to receive email updates before signing up.' }) }), website: text(200).optional().default('') });
export const unsubscribeSchema = z.object({ email: publicEmail, website: text(200).optional().default('') });

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error('Invalid input');
    error.status = 400;
    error.details = result.error.flatten();
    throw error;
  }
  return result.data;
}
