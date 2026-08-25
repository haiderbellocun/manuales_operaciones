import '../config/env.js';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
const CLOUD_SQL_CONNECTION_NAME = process.env.CLOUD_SQL_CONNECTION_NAME;

function getPoolConfig() {
  const base = {
    max: 20,
    idleTimeoutMillis: 30000,
  };

  if (DATABASE_URL) {
    return { ...base, connectionString: DATABASE_URL };
  }

  if (CLOUD_SQL_CONNECTION_NAME) {
    return {
      ...base,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: `/cloudsql/${CLOUD_SQL_CONNECTION_NAME}`,
    };
  }

  throw new Error('Configura DATABASE_URL o CLOUD_SQL_CONNECTION_NAME + DB_USER + DB_PASSWORD + DB_NAME.');
}

export const pool = new Pool(getPoolConfig());

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
