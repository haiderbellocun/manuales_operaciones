import { query } from './pool.js';

export async function getAreaById(areaId) {
  const { rows } = await query('SELECT * FROM areas WHERE id = $1', [Number(areaId)]);
  return rows[0] || null;
}

export async function getCoordinationById(coordinationId) {
  const { rows } = await query('SELECT * FROM coordinations WHERE id = $1', [Number(coordinationId)]);
  return rows[0] || null;
}

export function areaRequiresCoordination(area) {
  return Boolean(area?.requires_coordination);
}

export async function validateAreaCoordination(
  areaId,
  coordinationId,
  { allowGeneral = false } = {},
) {
  const area = await getAreaById(areaId);
  if (!area) {
    const err = new Error('El area seleccionada no existe.');
    err.statusCode = 400;
    throw err;
  }

  const needsCoordination = areaRequiresCoordination(area);
  const coordination = coordinationId ? await getCoordinationById(coordinationId) : null;

  if (needsCoordination) {
    if (!coordination) {
      if (allowGeneral) {
        return { area, coordination: null };
      }
      const err = new Error('Debes seleccionar la coordinacion correspondiente.');
      err.statusCode = 400;
      throw err;
    }
    if (Number(coordination.area_id) !== Number(area.id)) {
      const err = new Error('La coordinacion no pertenece al area seleccionada.');
      err.statusCode = 400;
      throw err;
    }
    return { area, coordination };
  }

  if (coordination) {
    const err = new Error('La coordinacion solo aplica para Coordinacion de Operacion Academica.');
    err.statusCode = 400;
    throw err;
  }

  return { area, coordination: null };
}

export function documentCodePrefix(area, coordination) {
  if (coordination?.abbreviation) return coordination.abbreviation;
  return area.abbreviation;
}
