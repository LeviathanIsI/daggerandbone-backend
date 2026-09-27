// Public CMS fields may outlive an editorial revision. Keep private identity
// out of every visitor-facing API projection while leaving admin records intact.
const personalName = /\b(?:Josh(?:ua)?|Bradford)\b/i;

export function sanitizePublicText(value) {
  if (typeof value !== 'string') return value;
  const revised = value
    .replace(/Josh, our founder, is developing our first collection\./gi, 'Our first collection is in development.')
    .replace(/Founder Josh is developing the first collection around custom scents and a straightforward approach to looking after yourself\./gi,
      'Our first collection is in development, with custom scents and a straightforward approach to looking after yourself.');
  if (!personalName.test(revised)) return revised;
  // Keep unrelated sentences; omit any that still need an editor's rewrite.
  return revised.split(/(?<=[.!?])\s+|\n+/).filter(sentence => !personalName.test(sentence)).join(' ').trim();
}

export function sanitizePublicCopy(value) {
  if (typeof value === 'string') return sanitizePublicText(value);
  if (Array.isArray(value)) return value.map(sanitizePublicCopy);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizePublicCopy(entry)]));
  }
  return value;
}
