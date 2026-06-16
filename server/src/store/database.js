import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

export const paths = {
  uploads: path.join(DATA_DIR, 'uploads'),
};

export function ensureUploadsDir() {
  if (!fs.existsSync(paths.uploads)) fs.mkdirSync(paths.uploads, { recursive: true });
}

export { today } from '../db/mapper.js';
