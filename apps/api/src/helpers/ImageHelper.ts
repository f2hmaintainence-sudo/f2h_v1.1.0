import * as fs from 'fs';
import * as path from 'path';
import { generateId } from './RandomHelper';

/**
 * Decodes a base64 image data URL and saves it to the uploads folder.
 * Returns the public web path to the saved image.
 *
 * @param base64Data Base64 Data URL (e.g. data:image/png;base64,...)
 * @param subfolder Target subfolder under /uploads (e.g. 'products', 'categories', 'variants')
 */
export function saveImageUpload(base64Data: string, subfolder: string): string {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return base64Data;
  }

  const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image data');
  }

  const ext = matches[1].replace('jpeg', 'jpg');
  const buffer = Buffer.from(matches[2], 'base64');

  const uploadsDir = path.join(process.cwd(), 'uploads', subfolder);

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = `${generateId('IMG', 16)}.${ext}`;
  const filepath = path.join(uploadsDir, filename);

  fs.writeFileSync(filepath, buffer);

  return `/uploads/${subfolder}/${filename}`;
}

/**
 * Converts any stored image path to a fully-qualified public URL.
 *
 * Handles all storage formats:
 *   - Already absolute  : 'http://...' or 'https://...' or 'data:image...' → returned as-is
 *   - Root-relative     : '/uploads/variants/foo.webp' → '<baseUrl>/uploads/variants/foo.webp'
 *   - Bare relative     : 'variants/foo.webp' → '<baseUrl>/uploads/variants/foo.webp'
 *   - Null / empty      : returns null
 *
 * @param rawPath  The value stored in the database (any format above)
 * @param baseUrl  The API base URL, e.g. process.env.BACKEND_URL
 */
export function resolveImageUrl(
  rawPath: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!rawPath || typeof rawPath !== 'string' || !rawPath.trim()) return null;

  let clean = rawPath.trim();

  // Already absolute — return unchanged
  if (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('data:image')
  ) {
    return clean;
  }

  // Strip leading '/uploads/' or 'uploads/'
  if (clean.startsWith('/uploads/')) {
    clean = clean.substring('/uploads/'.length);
  } else if (clean.startsWith('uploads/')) {
    clean = clean.substring('uploads/'.length);
  }

  // Strip any remaining leading slashes
  clean = clean.replace(/^\/+/, '');

  return `${baseUrl}/uploads/${clean}`;
}
