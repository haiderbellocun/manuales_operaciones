import { query } from '../pool.js';
import { mapUser } from '../mapper.js';

export async function findByEmail(email) {
  const { rows } = await query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [Number(id)]);
  return rows[0] || null;
}

export async function updateLastAccess(id) {
  const today = new Date().toISOString().slice(0, 10);
  await query('UPDATE users SET last_access = $1 WHERE id = $2', [today, Number(id)]);
}

export async function getRoleName(roleId) {
  const { rows } = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
  return rows[0]?.name || roleId;
}

export async function getRole(roleId) {
  const { rows } = await query('SELECT id, name, perms FROM roles WHERE id = $1', [Number(roleId)]);
  return rows[0] || null;
}

export async function getAuthContext(userId) {
  const { rows } = await query(`
    SELECT u.id, u.email, u.role_id, u.status, r.name AS role_name, r.perms
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = $1
  `, [Number(userId)]);
  return rows[0] || null;
}

export async function sanitizeUser(user) {
  const role = await getRole(user.role_id);
  const { password, ...rest } = user;
  return mapUser(rest, role?.name || user.role_id, role?.perms || {});
}

export async function listUsers() {
  const { rows } = await query('SELECT * FROM users ORDER BY name');
  return Promise.all(rows.map(u => sanitizeUser(u)));
}

export async function listAssignableUsers() {
  const { rows } = await query(`
    SELECT u.id, u.name, u.role_id, u.area_id, u.status
    FROM users u
    WHERE u.status = 'Activo'
    ORDER BY u.name
  `);
  return rows.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role_id,
    area: u.area_id,
    status: u.status,
  }));
}

export async function findUserByPersonId(personId) {
  const { rows } = await query(`
    SELECT u.*
    FROM people p
    JOIN users u ON LOWER(u.name) = LOWER(p.name)
    WHERE p.id = $1
      AND u.status = 'Activo'
    LIMIT 1
  `, [Number(personId)]);
  return rows[0] || null;
}

export async function findAreaLeader(areaId) {
  const { rows } = await query(`
    SELECT *
    FROM users
    WHERE area_id = $1
      AND role_id = 2
      AND status = 'Activo'
    ORDER BY id
    LIMIT 1
  `, [Number(areaId)]);
  return rows[0] || null;
}

export async function findDocumentOwnerRecipient(ownerId, areaId) {
  return (await findUserByPersonId(ownerId)) || (await findAreaLeader(areaId));
}

export function userForToken(user) {
  return { id: user.id, email: user.email, role: user.role_id };
}
