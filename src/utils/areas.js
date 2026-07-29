export const OPERATION_ACADEMIC_AREA_ID = 1;
export const OPERATION_ACADEMIC_FULL_ROLE_ID = 8;

export function areaRequiresCoordination(area) {
  return Boolean(area?.requiresCoordination);
}

export function coordinationsForArea(coordinations = [], areaId) {
  if (!areaId) return [];
  return coordinations.filter(c => Number(c.areaId) === Number(areaId));
}

export function areaAssignmentValid(area, coordinationId, { allowGeneral = false } = {}) {
  if (!area) return !coordinationId;
  if (areaRequiresCoordination(area)) return Boolean(coordinationId) || allowGeneral;
  return !coordinationId;
}

export function documentCodePrefix(area, coordination) {
  if (coordination?.abbreviation) return coordination.abbreviation;
  return area?.abbreviation || '';
}
