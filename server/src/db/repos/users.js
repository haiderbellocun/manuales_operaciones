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
    SELECT u.id, u.name, u.email, u.role_id, u.area_id, u.status, r.name AS role_name, r.perms
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

function normalizeUserPayload(payload = {}, { partial = false } = {}) {
  const data = {};
  if (!partial || payload.name !== undefined) data.name = String(payload.name || '').trim();
  if (!partial || payload.email !== undefined) data.email = String(payload.email || '').trim().toLowerCase();
  if (!partial || payload.role !== undefined || payload.role_id !== undefined) data.roleId = Number(payload.role ?? payload.role_id);
  if (payload.area !== undefined || payload.area_id !== undefined) {
    const area = payload.area ?? payload.area_id;
    data.areaId = area === '' || area === null ? null : Number(area);
  } else if (!partial) {
    data.areaId = null;
  }
  if (!partial || payload.status !== undefined) data.status = payload.status || 'Activo';
  if (payload.password !== undefined) data.password = String(payload.password || '');
  return data;
}

function validateUserPayload(data, { creating = false } = {}) {
  if ('name' in data && !data.name) {
    const err = new Error('El nombre del usuario es obligatorio.');
    err.statusCode = 400;
    throw err;
  }
  if ('email' in data && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    const err = new Error('El correo institucional no es valido.');
    err.statusCode = 400;
    throw err;
  }
  if ('roleId' in data && (!Number.isInteger(data.roleId) || data.roleId <= 0)) {
    const err = new Error('Selecciona un rol valido.');
    err.statusCode = 400;
    throw err;
  }
  if ('areaId' in data && data.areaId !== null && (!Number.isInteger(data.areaId) || data.areaId <= 0)) {
    const err = new Error('Selecciona un area valida.');
    err.statusCode = 400;
    throw err;
  }
  if ('status' in data && !['Activo', 'Inactivo'].includes(data.status)) {
    const err = new Error('Estado de usuario invalido.');
    err.statusCode = 400;
    throw err;
  }
  if (creating && (!data.password || data.password.length < 4)) {
    const err = new Error('La contrasena inicial debe tener minimo 4 caracteres.');
    err.statusCode = 400;
    throw err;
  }
  if (!creating && 'password' in data && data.password && data.password.length < 4) {
    const err = new Error('La nueva contrasena debe tener minimo 4 caracteres.');
    err.statusCode = 400;
    throw err;
  }
}

async function assertRoleExists(roleId) {
  const role = await getRole(roleId);
  if (!role) {
    const err = new Error('El rol seleccionado no existe.');
    err.statusCode = 400;
    throw err;
  }
}

async function assertAreaExists(areaId) {
  if (areaId === null || areaId === undefined) return;
  const { rows } = await query('SELECT 1 FROM areas WHERE id = $1', [areaId]);
  if (!rows.length) {
    const err = new Error('El area seleccionada no existe.');
    err.statusCode = 400;
    throw err;
  }
}

export async function createUser(payload) {
  const data = normalizeUserPayload(payload);
  validateUserPayload(data, { creating: true });
  await assertRoleExists(data.roleId);
  await assertAreaExists(data.areaId);

  try {
    const { rows } = await query(`
      INSERT INTO users (name, email, password, role_id, area_id, status, last_access)
      VALUES ($1,$2,$3,$4,$5,$6,NULL)
      RETURNING *
    `, [data.name, data.email, data.password, data.roleId, data.areaId, data.status]);
    return sanitizeUser(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const dup = new Error('Ya existe un usuario con ese correo.');
      dup.statusCode = 409;
      throw dup;
    }
    throw err;
  }
}

export async function updateUser(id, payload) {
  const userId = Number(id);
  const current = await findById(userId);
  if (!current) {
    const err = new Error('Usuario no encontrado.');
    err.statusCode = 404;
    throw err;
  }

  const data = normalizeUserPayload(payload, { partial: true });
  validateUserPayload(data);
  if ('roleId' in data) await assertRoleExists(data.roleId);
  if ('areaId' in data) await assertAreaExists(data.areaId);

  const next = {
    name: data.name ?? current.name,
    email: data.email ?? current.email,
    roleId: data.roleId ?? current.role_id,
    areaId: ('areaId' in data) ? data.areaId : current.area_id,
    status: data.status ?? current.status,
    password: data.password || current.password,
  };

  try {
    const { rows } = await query(`
      UPDATE users
      SET name = $2,
          email = $3,
          role_id = $4,
          area_id = $5,
          status = $6,
          password = $7
      WHERE id = $1
      RETURNING *
    `, [userId, next.name, next.email, next.roleId, next.areaId, next.status, next.password]);
    return sanitizeUser(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const dup = new Error('Ya existe un usuario con ese correo.');
      dup.statusCode = 409;
      throw dup;
    }
    throw err;
  }
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
