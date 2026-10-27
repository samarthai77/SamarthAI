'use strict';
const sharp = require('sharp');
const MAX_BYTES = 5 * 1024 * 1024;
const limits = { fileSize: MAX_BYTES, files: 1, fields: 8, parts: 9, fieldSize: 8192, fieldNameSize: 100 };
let active = 0;
function uploadSlot(req, res, next) {
  if (active >= 4) return res.status(429).json({ error: 'Upload busy. Please try again later.' });
  active++;
  let released = false;
  const release = () => { if (!released) { released = true; active--; } };
  res.once('finish', release);
  res.once('close', release);
  next();
}
function signature(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
async function normalizeImage(buffer, mime) {
  const format = Buffer.isBuffer(buffer) && signature(buffer);
  if (!format || !buffer.length || buffer.length > MAX_BYTES || mime !== `image/${format}`) throw new Error('Invalid image');
  const image = sharp(buffer, { limitInputPixels: 16000000, failOn: 'warning', animated: false });
  const meta = await image.metadata();
  if (meta.format !== format || !meta.width || !meta.height || meta.width > 4096 || meta.height > 4096 || (meta.pages || 1) !== 1) throw new Error('Invalid image');
  // Full decoding and re-encoding strips metadata, trailing payloads and unsafe originals.
  const output = await image.rotate().webp({ quality: 85 }).timeout({ seconds: 5 }).toBuffer();
  if (output.length > MAX_BYTES) throw new Error('Invalid image');
  return output;
}
async function validateImage(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  try {
    req.file.buffer = await normalizeImage(req.file.buffer, req.file.mimetype);
    req.file.mimetype = 'image/webp';
    req.file.size = req.file.buffer.length;
    next();
  } catch {
    res.status(400).json({ error: 'Upload a valid JPG, PNG or WebP image, at most 5MB and 4096 pixels per dimension' });
  }
}
module.exports = { limits, uploadSlot, normalizeImage, validateImage, signature };
