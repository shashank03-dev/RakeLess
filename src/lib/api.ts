import { VisionResult, type AnalyzeResponse, type Context } from '../../shared/schema';

export type Attribution = {
  title: string; author: string; place: string; license: string; licenseUrl: string; sourceUrl: string; modifications: string;
};
export type Run = AnalyzeResponse & { attribution?: Attribution };

export type Health = {
  app: { ready: boolean };
  model: { ready: boolean; provider: string; name: string; reason: string | null };
  promptVersion: string;
  rulesVersion: string;
};

export type Stage = 'preparing' | 'uploading' | 'reading' | 'validating' | 'rules';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const MAX_BYTES = 8 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 3.5 * 1024 * 1024; // keep under the hosting body limit
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function getHealth(): Promise<Health> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch('/api/health', { signal: ctrl.signal });
    if (!r.ok) throw new Error();
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function getExample(id: string): Promise<Run> {
  const r = await fetch(`/api/examples/${encodeURIComponent(id)}`);
  const body = await r.json();
  if (!r.ok) throw new ApiError(body.error ?? 'Could not load the example.', r.status);
  return body;
}

/** Large photos are scaled down in the browser first; the server still validates and normalizes. */
async function prepare(file: File): Promise<Blob> {
  if (file.size > MAX_BYTES) throw new ApiError('Image is larger than 8 MB.', 413);
  if (file.type && !TYPES.includes(file.type)) throw new ApiError('Use a JPEG, PNG, or WebP photo.', 400);
  if (file.size <= DIRECT_UPLOAD_BYTES) return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ApiError('That file could not be decoded as an image.', 400);
  }
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new ApiError('Could not prepare the image.', 400))), 'image/jpeg', 0.9));
}

export async function analyzePhoto(file: File, ctx: Context, onStage: (s: Stage) => void, signal: AbortSignal): Promise<Run> {
  onStage('preparing');
  const blob = await prepare(file);
  const form = new FormData();
  form.append('image', blob, file.name || 'photo.jpg');
  form.append('context', JSON.stringify(ctx));
  onStage('uploading');

  const { status, body } = await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/analyze');
    xhr.responseType = 'json';
    xhr.timeout = 70_000;
    xhr.upload.onload = () => onStage('reading');
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.response });
    xhr.onerror = () => reject(new ApiError('Network error — the server could not be reached.', 0));
    xhr.ontimeout = () => reject(new ApiError('The request timed out.', 504));
    signal.addEventListener('abort', () => { xhr.abort(); reject(new ApiError('Cancelled.', 499)); });
    xhr.send(form);
  });
  if (status !== 200) throw new ApiError(body?.error ?? `Analysis failed (${status}).`, status);

  onStage('validating');
  // Re-check the contract in the browser too; a server bug must not become a plan.
  const checked = VisionResult.safeParse({ observations: body.observations });
  if (!checked.success) throw new ApiError('The response did not contain nine valid observations.', 502);
  onStage('rules');
  return { ...body, observations: checked.data.observations };
}
