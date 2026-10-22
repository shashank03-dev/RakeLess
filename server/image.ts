import crypto from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { gridRegions } from '../shared/grid';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 20_000_000;
export const MAX_LONG_SIDE = 1536;
const ALLOWED = new Set(['jpeg', 'png', 'webp']);

export class ImageError extends Error {
  constructor(message: string, public status: 400 | 413) {
    super(message);
  }
}

export type NormalizedImage = { buffer: Buffer; width: number; height: number; sha256: string };

/** Validate the decoded format (not the filename), fix orientation, strip metadata, resize. */
export async function normalizeImage(input: Buffer): Promise<NormalizedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ImageError('Image is larger than 8 MB.', 413);
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    throw new ImageError('That file could not be decoded as an image.', 400);
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ImageError('Use a JPEG, PNG, or WebP photo.', 400);
  if (!meta.width || !meta.height) throw new ImageError('That image has no readable dimensions.', 400);
  if (meta.width * meta.height > MAX_INPUT_PIXELS) throw new ImageError('Image is larger than 20 megapixels.', 413);
  try {
    // rotate() applies EXIF orientation; re-encoding drops metadata.
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height, sha256: crypto.createHash('sha256').update(data).digest('hex') };
  } catch {
    throw new ImageError('That image appears to be corrupt or truncated.', 400);
  }
}

/** A copy with thin grid lines and small cell IDs in the corner, for the model only. */
export async function annotateImage(img: NormalizedImage): Promise<Buffer> {
  const { width: W, height: H } = img;
  const regions = gridRegions(W, H);
  const fs = Math.max(14, Math.round(Math.min(W, H) / 28));
  const lines = [regions[1].left, regions[2].left].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`)
    .concat([regions[3].top, regions[6].top].map((y) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`));
  const labels = regions.map((r) => {
    const x = r.left + 6, y = r.top + 6, w = fs * 1.9, h = fs * 1.35;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#111" fill-opacity="0.8"/>` +
      `<text x="${x + w / 2}" y="${y + h * 0.74}" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="${fs}" font-weight="700" fill="#fff">${r.id}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g stroke="#fff" stroke-width="2" stroke-opacity="0.9">${lines.join('')}</g>${labels.join('')}</svg>`;
  return sharp(img.buffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 82 }).toBuffer();
}

/** Nine crops matching the grid exactly, so the model can look closely at each cell. */
export async function cropCells(img: NormalizedImage, maxSide = 448): Promise<{ id: string; buffer: Buffer }[]> {
  return Promise.all(
    gridRegions(img.width, img.height).map(async (r) => ({
      id: r.id,
      buffer: await sharp(img.buffer)
        .extract({ left: r.left, top: r.top, width: r.width, height: r.height })
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer(),
    })),
  );
}
