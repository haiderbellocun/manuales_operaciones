import { query } from '../pool.js';
import { mapUser } from '../mapper.js';
import { assertAllowedGoogleEmail } from '../../services/googleIdentity.js';
import { validateAreaCoordination, getAreaById, areaRequiresCoordination } from '../areaRules.js';
import {
  AREA_LEADER_ROLE_ID,
  APPROVER_ROLE_IDS,
  OPERATION_ACADEMIC_COORDINATOR_ROLE_ID,
  REVIEWER_ROLE_ID,
  REVIEWER_ROLE_IDS,
  WORKFLOW_ASSIGNABLE_ROLE_IDS,
} from '../../config/workflowRoles.js';

const DEFAULT_GOOGLE_ROLE_ID = Number(process.env.GOOGLE_DEFAULT_ROLE_ID || 7);
const OPERATION_ACADEMIC_AREA_ID = 1;
const OPERATION_ACADEMIC_FULL_ROLE_ID = OPERATION_ACADEMIC_COORDINATOR_ROLE_ID;

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

async function assertAreaAssignment(areaId, coordinationId, roleId = null) {
  const normalizedRoleId = Number(roleId);
  if (WORKFLOW_ASSIGNABLE_ROLE_IDS.includes(normalizedRoleId) && !areaId) {
    const err = new Error('Este rol debe tener un area asignada para participar en el flujo documental.');
    err.statusCode = 400;
    throw err;
  }
  if (
    normalizedRoleId === OPERATION_ACADEMIC_COORDINATOR_ROLE_ID
    && Number(areaId) !== OPERATION_ACADEMIC_AREA_ID
  ) {
    const err = new Error('El Coordinador de Operacion Academica debe pertenecer a Operacion Academica.');
    err.statusCode = 400;
    throw err;
  }
  if (areaId === null || areaId === undefined) {
    if (coordinationId) {
      const err = new Error('La coordinacion requiere un area valida.');
      err.statusCode = 400;
      throw err;
    }
    return;
  }
  if (
    Number(roleId) === OPERATION_ACADEMIC_FULL_ROLE_ID
    && Number(areaId) === OPERATION_ACADEMIC_AREA_ID
    && !coordinationId
  ) {
    return;
  }
  await validateAreaCoordination(areaId, coordinationId);
}

export async function createUser(payload) {
  const data = normalizeUserPayload(payload);
  validateUserPayload(data, { creating: true });
  await assertRoleExists(data.roleId);
  await assertAreaAssignment(data.areaId, data.coordinationId ?? null, data.roleId);

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

export async function createGoogleUser({ email, name, picture }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const profilePictureUrl = String(picture || '').trim() || null;
  assertAllowedGoogleEmail(normalizedEmail);
  await assertRoleExists(DEFAULT_GOOGLE_ROLE_ID);

  try {
    const { rows } = await query(`
      INSERT INTO users (name, email, profile_picture_url, role_id, area_id, status, last_access)
      VALUES ($1,$2,$3,$4,NULL,'Activo',NULL)
      RETURNING *
    `, [
      String(name || '').trim() || defaultNameFromEmail(normalizedEmail),
      normalizedEmail,
      profilePictureUrl,
      DEFAULT_GOOGLE_ROLE_ID,
    ]);
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      return findByEmail(normalizedEmail);
    }
    throw err;
  }
}

export async function updateGoogleProfilePicture(id, picture) {
  const profilePictureUrl = String(picture || '').trim() || null;
  const { rows } = await query(`
    UPDATE users
    SET profile_picture_url = $2
    WHERE id = $1
      AND profile_picture_url IS DISTINCT FROM $2
    RETURNING *
  `, [Number(id), profilePictureUrl]);
  return rows[0] || findById(id);
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

  const nextRoleId = data.roleId ?? current.role_id;
  const nextAreaId = ('areaId' in data) ? data.areaId : current.area_id;
  let nextCoordinationId = ('coordinationId' in data) ? data.coordinationId : current.coordination_id;
  if (nextAreaId) {
    const area = await getAreaById(nextAreaId);
    if (!areaRequiresCoordination(area)) nextCoordinationId = null;
  } else {
    nextCoordinationId = null;
  }
  await assertAreaAssignment(nextAreaId, nextCoordinationId, nextRoleId);

  const next = {
    name: data.name ?? current.name,
    email: data.email ?? current.email,
    roleId: nextRoleId,
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

export async function listAssignableUsers(areaId = null) {
  const normalizedAreaId = areaId === null || areaId === undefined || areaId === ''
    ? null
    : Number(areaId);
  if (
    normalizedAreaId !== null
    && (!Number.isInteger(normalizedAreaId) || normalizedAreaId <= 0)
  ) {
    const err = new Error('Selecciona un area valida para consultar el flujo.');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(`
    SELECT u.id, u.name, u.role_id, u.area_id, u.coordination_id, u.status,
           r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.status = 'Activo'
      AND u.role_id = ANY($1::int[])
      AND ($2::int IS NULL OR u.area_id = $2)
    ORDER BY u.name
  `, [WORKFLOW_ASSIGNABLE_ROLE_IDS, normalizedAreaId]);
  return rows.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role_id,
    roleName: u.role_name,
    area: u.area_id,
    coordination: u.coordination_id,
    status: u.status,
  }));
}

function workflowAssignmentError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

export async function validateWorkflowAssignments(reviewerId, approverId, areaId) {
  const normalizedReviewerId = Number(reviewerId);
  const normalizedApproverId = Number(approverId);
  const normalizedAreaId = Number(areaId);
  if (!Number.isInteger(normalizedReviewerId) || normalizedReviewerId <= 0) {
    throw workflowAssignmentError('Debes seleccionar un usuario activo y habilitado como revisor.');
  }
  if (!Number.isInteger(normalizedApproverId) || normalizedApproverId <= 0) {
    throw workflowAssignmentError('Debes seleccionar un usuario activo y habilitado como aprobador.');
  }

  const { rows } = await query(`
    SELECT id, name, role_id, area_id, coordination_id, status
    FROM users
    WHERE id = ANY($1::int[])
  `, [[normalizedReviewerId, normalizedApproverId]]);
  const reviewer = rows.find(user => Number(user.id) === normalizedReviewerId);
  const approver = rows.find(user => Number(user.id) === normalizedApproverId);

  if (
    !reviewer
    || reviewer.status !== 'Activo'
    || !REVIEWER_ROLE_IDS.includes(Number(reviewer.role_id))
  ) {
    throw workflowAssignmentError('El revisor debe estar activo y tener rol Revisor, Lider de area o Coordinador de Operacion Academica.');
  }
  if (
    !approver
    || approver.status !== 'Activo'
    || !APPROVER_ROLE_IDS.includes(Number(approver.role_id))
  ) {
    throw workflowAssignmentError('El aprobador debe estar activo y tener rol Aprobador, Lider de area o Coordinador de Operacion Academica.');
  }
  if (Number(reviewer.area_id) !== normalizedAreaId) {
    throw workflowAssignmentError('El revisor seleccionado debe pertenecer al area responsable del documento.');
  }
  if (Number(approver.area_id) !== normalizedAreaId) {
    throw workflowAssignmentError('El aprobador seleccionado debe pertenecer al area responsable del documento.');
  }

  return { reviewer, approver };
}

export async function findAreaReviewer(areaId) {
  const { rows } = await query(`
    SELECT *
    FROM users
    WHERE role_id = ANY($1::int[])
      AND status = 'Activo'
      AND area_id = $2
    ORDER BY
      CASE
        WHEN role_id = $3 THEN 0
        WHEN role_id = $4 THEN 1
        ELSE 2
      END,
      id
    LIMIT 1
  `, [
    REVIEWER_ROLE_IDS,
    Number(areaId),
    REVIEWER_ROLE_ID,
    AREA_LEADER_ROLE_ID,
  ]);
  return rows[0] || null;
}

export async function resolveResponsiblePerson(userId) {
  const { rows } = await query(`
    WITH account AS (
      SELECT u.id, u.name, u.area_id, u.coordination_id, r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
        AND u.status = 'Activo'
    ),
    existing AS (
      SELECT p.id
      FROM people p
      JOIN account a ON LOWER(p.name) = LOWER(a.name)
      ORDER BY
        CASE
          WHEN p.area_id IS NOT DISTINCT FROM a.area_id
            AND p.coordination_id IS NOT DISTINCT FROM a.coordination_id
          THEN 0 ELSE 1
        END,
        p.id
      LIMIT 1
    ),
    updated AS (
      UPDATE people p
      SET role_title = a.role_name,
          area_id = a.area_id,
          coordination_id = a.coordination_id
      FROM account a, existing e
      WHERE p.id = e.id
      RETURNING p.*
    ),
    inserted AS (
      INSERT INTO people (name, role_title, area_id, coordination_id)
      SELECT a.name, a.role_name, a.area_id, a.coordination_id
      FROM account a
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING *
    )
    SELECT * FROM updated
    UNION ALL
    SELECT * FROM inserted
    LIMIT 1
  `, [Number(userId)]);

  if (!rows[0]) {
    const err = new Error('No se pudo asignar al usuario actual como responsable del documento.');
    err.statusCode = 409;
    throw err;
  }
  return rows[0];
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
      AND (
        role_id = 2
        OR (role_id = $2 AND $1 = $3)
      )
      AND status = 'Activo'
    ORDER BY CASE WHEN role_id = 2 THEN 0 ELSE 1 END, id
    LIMIT 1
  `, [Number(areaId), OPERATION_ACADEMIC_FULL_ROLE_ID, OPERATION_ACADEMIC_AREA_ID]);
  return rows[0] || null;
}

export async function findDocumentOwnerRecipient(ownerId, areaId) {
  return (await findUserByPersonId(ownerId)) || (await findAreaLeader(areaId));
}

export function userForToken(user) {
  return { id: user.id, email: user.email, role: user.role_id };
}
