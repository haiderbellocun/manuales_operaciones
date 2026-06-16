import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL no está definido en las variables de entorno. Configura server/.env');

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function checkConnection() {
  const res = await pool.query('SELECT NOW() AS now');
  return res.rows[0];
}
