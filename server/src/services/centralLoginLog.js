import pg from 'pg';

const {
  LOGIN_LOGS_DB_HOST,
  LOGIN_LOGS_DB_PORT = '5432',
  LOGIN_LOGS_DB_NAME = 'core',
  LOGIN_LOGS_DB_USER,
  LOGIN_LOGS_DB_PASSWORD = '',
  LOGIN_LOGS_DB_SSL = 'true',
} = process.env;

let pool = null;

function getPool() {
  if (!LOGIN_LOGS_DB_HOST) return null;
  if (pool) return pool;

  pool = new pg.Pool({
    host: LOGIN_LOGS_DB_HOST,
    port: Number(LOGIN_LOGS_DB_PORT),
    database: LOGIN_LOGS_DB_NAME,
    user: LOGIN_LOGS_DB_USER,
    password: String(LOGIN_LOGS_DB_PASSWORD).replace(/^'|'$/g, ''),
    ssl:
      LOGIN_LOGS_DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

/** Fire-and-forget. No tumba el login si falla. */
export function recordAppLogin(email, appLogin = 'acervo') {
  const correo = String(email ?? '').trim().toLowerCase();
  const p = getPool();
  if (!correo || !p) return;

  void p
    .query(
      `
      INSERT INTO logs.login_apps (correo, fecha, hora, app_login)
      VALUES (
        $1,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::time,
        $2
      )
      `,
      [correo, appLogin],
    )
    .catch((error) => {
      console.warn('[centralLoginLog] No se pudo registrar login:', error);
    });
}
