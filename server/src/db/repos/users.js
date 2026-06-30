import { query } from '../pool.js';
import { mapUser } from '../mapper.js';
import { assertAllowedGoogleEmail } from '../../services/googleIdentity.js';
import { validateAreaCoordination, getAreaById, areaRequiresCoordination } from '../areaRules.js';

const DEFAULT_GOOGLE_ROLE_ID = Number(process.env.GOOGLE_DEFAULT_ROLE_ID || 7);

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
    SELECT u.id, u.name, u.email, u.role_id, u.area_id, u.coordination_id, u.status, r.name AS role_name, r.perms
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = $1
  `, [Number(userId)]);
  return rows[0] || null;
}

export async function sanitizeUser(user) {
  const role = await getRole(user.role_id);
  return mapUser(user, role?.name || user.role_id, role?.perms || {});
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
  if (payload.coordination !== undefined || payload.coordination_id !== undefined) {
    const coordination = payload.coordination ?? payload.coordination_id;
    data.coordinationId = coordination === '' || coordination === null ? null : Number(coordination);
  } else if (!partial) {
    data.coordinationId = null;
  }
  if (!partial || payload.status !== undefined) data.status = payload.status || 'Activo';
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
  if ('email' in data) assertAllowedGoogleEmail(data.email);
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
  if ('coordinationId' in data && data.coordinationId !== null && (!Number.isInteger(data.coordinationId) || data.coordinationId <= 0)) {
    const err = new Error('Selecciona una coordinacion valida.');
    err.statusCode = 400;
    throw err;
  }
  if ('status' in data && !['Activo', 'Inactivo'].includes(data.status)) {
    const err = new Error('Estado de usuario invalido.');
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

async function assertAreaAssignment(areaId, coordinationId) {
  if (areaId === null || areaId === undefined) {
    if (coordinationId) {
      const err = new Error('La coordinacion requiere un area valida.');
      err.statusCode = 400;
      throw err;
    }
    return;
  }
  await validateAreaCoordination(areaId, coordinationId);
}

export async function createUser(payload) {
  const data = normalizeUserPayload(payload);
  validateUserPayload(data, { creating: true });
  await assertRoleExists(data.roleId);
  await assertAreaAssignment(data.areaId, data.coordinationId ?? null);

  try {
    const { rows } = await query(`
      INSERT INTO users (name, email, role_id, area_id, coordination_id, status, last_access)
      VALUES ($1,$2,$3,$4,$5,$6,NULL)
      RETURNING *
    `, [data.name, data.email, data.roleId, data.areaId, data.coordinationId ?? null, data.status]);
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

function defaultNameFromEmail(email) {
  return String(email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase()) || 'Usuario CUN';
}

export async function createGoogleUser({ email, name }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  assertAllowedGoogleEmail(normalizedEmail);
  await assertRoleExists(DEFAULT_GOOGLE_ROLE_ID);

  try {
    const { rows } = await query(`
      INSERT INTO users (name, email, role_id, area_id, status, last_access)
      VALUES ($1,$2,$3,NULL,'Activo',NULL)
      RETURNING *
    `, [String(name || '').trim() || defaultNameFromEmail(normalizedEmail), normalizedEmail, DEFAULT_GOOGLE_ROLE_ID]);
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      return findByEmail(normalizedEmail);
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

  const nextAreaId = ('areaId' in data) ? data.areaId : current.area_id;
  let nextCoordinationId = ('coordinationId' in data) ? data.coordinationId : current.coordination_id;
  if (nextAreaId) {
    const area = await getAreaById(nextAreaId);
    if (!areaRequiresCoordination(area)) nextCoordinationId = null;
  } else {
    nextCoordinationId = null;
  }
  if ('areaId' in data || 'coordinationId' in data) {
    await assertAreaAssignment(nextAreaId, nextCoordinationId);
  }

  const next = {
    name: data.name ?? current.name,
    email: data.email ?? current.email,
    roleId: data.roleId ?? current.role_id,
    areaId: nextAreaId,
    coordinationId: nextCoordinationId,
    status: data.status ?? current.status,
  };

  try {
    const { rows } = await query(`
      UPDATE users
      SET name = $2,
          email = $3,
          role_id = $4,
          area_id = $5,
          coordination_id = $6,
          status = $7
      WHERE id = $1
      RETURNING *
    `, [userId, next.name, next.email, next.roleId, next.areaId, next.coordinationId, next.status]);
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
    SELECT u.id, u.name, u.role_id, u.area_id, u.coordination_id, u.status
    FROM users u
    WHERE u.status = 'Activo'
    ORDER BY u.name
  `);
  return rows.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role_id,
    area: u.area_id,
    coordination: u.coordination_id,
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
