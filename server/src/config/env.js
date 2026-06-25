import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true });

if (
  process.env.GOOGLE_APPLICATION_CREDENTIALS
  && !path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    projectRoot,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} no esta definido en las variables de entorno.`);
  }
}

if (process.env.NODE_ENV === 'production') {
  [
    'JWT_SECRET',
    'CORS_ORIGIN',
    'APP_URL',
    'GCS_BUCKET',
    'CLOUD_SQL_CONNECTION_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'GOOGLE_OAUTH_CLIENT_ID',
  ].forEach(requireEnv);
}
