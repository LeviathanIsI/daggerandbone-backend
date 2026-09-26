import { v2 as cloudinary } from 'cloudinary';

export function isAllowedImage(file) {
  if (!file?.buffer || file.size > 6 * 1024 * 1024 || file.size < 8) return false;
  const b = file.buffer;
  const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const gif = b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a';
  const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  const avif = b.toString('ascii', 4, 12).includes('ftypavif') || b.toString('ascii', 4, 12).includes('ftypavis');
  return (png && file.mimetype === 'image/png') || (jpeg && file.mimetype === 'image/jpeg') || (gif && file.mimetype === 'image/gif') || (webp && file.mimetype === 'image/webp') || (avif && file.mimetype === 'image/avif');
}

export function createImageUploader(config) {
  if (config.cloudName && config.apiKey && config.apiSecret) {
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
  }
  return async (file) => {
    if (!isAllowedImage(file)) {
      const error = new Error('Use a PNG, JPEG, GIF, WebP, or AVIF image up to 6 MB.');
      error.status = 400;
      throw error;
    }
    if (!config.cloudName || !config.apiKey || !config.apiSecret) {
      const error = new Error('Image uploads are not configured.');
      error.status = 503;
      throw error;
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'dagger-and-bone', resource_type: 'image', overwrite: false }, (error, data) => error ? reject(error) : resolve(data));
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, format: result.format, resourceType: result.resource_type, alt: '', caption: '', order: 0 };
  };
}
