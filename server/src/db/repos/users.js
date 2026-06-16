import { query } from '../pool.js';
import { mapDocument, mapUser } from '../mapper.js';

export async function findByEmail(email) {
  const { rows } = await query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateLastAccess(id) {
  const today = new Date().toISOString().slice(0, 10);
  await query('UPDATE users SET last_access = $1 WHERE id = $2', [today, id]);
}

export async function getRoleName(roleId) {
  const { rows } = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
  return rows[0]?.name || roleId;
}

export async function sanitizeUser(user) {
  const roleName = await getRoleName(user.role_id);
  const { password, ...rest } = user;
  return mapUser(rest, roleName);
}

export async function listUsers() {
  const { rows } = await query('SELECT * FROM users ORDER BY name');
  return Promise.all(rows.map(u => sanitizeUser(u)));
}

export function userForToken(user) {
  return { id: user.id, email: user.email, role: user.role_id };
}
