import pg from 'pg';

let pool = null;

function readConfig() {
  const host = process.env.LOGIN_LOGS_DB_HOST;
  if (!host) return null;

  return {
    host,
    port: Number(process.env.LOGIN_LOGS_DB_PORT || 5432),
    database: process.env.LOGIN_LOGS_DB_NAME || 'core',
    user: process.env.LOGIN_LOGS_DB_USER,
    password: String(process.env.LOGIN_LOGS_DB_PASSWORD || '').replace(/^'|'$/g, ''),
    ssl:
      (process.env.LOGIN_LOGS_DB_SSL || 'true') === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    max: 2,
    connectionTimeoutMillis: 5000,
  };
}

function getPool() {
  const config = readConfig();
  if (!config) return null;
  if (pool) return pool;

  pool = new pg.Pool(config);
  return pool;
}

/** Fire-and-forget. No tumba el login si falla. */
export function recordAppLogin(email, appLogin = 'acervo') {
  const correo = String(email ?? '').trim().toLowerCase();
  if (!correo) return;

  const p = getPool();
  if (!p) {
    console.warn('[centralLoginLog] LOGIN_LOGS_DB_HOST no configurado; se omite el registro.');
    return;
  }

  void p
    .query(
      `
      INSERT INTO logs.login_apps (correo, fecha, hora, app_login)
      VALUES (
        $1,
        to_char((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'), 'DD-MM-YYYY'),
        to_char((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'), 'HH24:MI'),
        $2
      )
      `,
      [correo, appLogin],
    )
    .catch((error) => {
      console.warn('[centralLoginLog] No se pudo registrar login:', error.message || error);
    });
}
