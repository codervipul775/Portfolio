import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Null when the env vars are missing, so the admin can say so instead of crashing. */
export const supabase = url && key ? createClient(url, key) : null;

const BUCKET = 'site-assets';
const ONE_YEAR = '31536000';

async function upload(path: string, file: Blob, contentType: string) {
  const { error } = await supabase!.storage.from(BUCKET).upload(path, file, { contentType, cacheControl: ONE_YEAR });
  if (error) throw new Error(error.message);
  return supabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality));

/**
 * Shrinks the image to at most 2400px and re-encodes it (WebP where the browser
 * can), then uploads it. The site build optimizes it further for each screen size.
 */
export async function uploadImage(file: File, folder: string) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await toBlob(canvas, 'image/webp', 0.88);
  // Safari can't encode WebP and silently returns PNG; use JPEG then, unless transparency matters.
  if (blob.type !== 'image/webp') blob = await toBlob(canvas, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
  const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');

  const url = await upload(`${folder}/${crypto.randomUUID()}.${ext}`, blob, blob.type);
  return { url, width, height };
}

export function uploadPdf(file: File, folder: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return upload(`${folder}/${stamp}-${crypto.randomUUID().slice(0, 8)}.pdf`, file, 'application/pdf');
}

/** The current session's access token, for calls to our own /api routes. */
export async function accessToken() {
  const { data } = await supabase!.auth.getSession();
  return data.session?.access_token;
}
