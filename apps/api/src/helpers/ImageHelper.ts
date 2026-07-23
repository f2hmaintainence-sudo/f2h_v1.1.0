import * as fs from 'fs';
import * as path from 'path';
import { generateId } from './RandomHelper';

/**
 * Decodes a base64 image data URL and saves it to the uploads folder.
 * Returns the public web path to the saved image.
 * 
 * @param base64Data Base64 Data URL (e.g. data:image/png;base64,...)
 * @param subfolder Target subfolder under /uploads (e.g. 'products', 'categories')
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
