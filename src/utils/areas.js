export function areaRequiresCoordination(area) {
  return Boolean(area?.requiresCoordination);
}

export function coordinationsForArea(coordinations = [], areaId) {
  if (!areaId) return [];
  return coordinations.filter(c => Number(c.areaId) === Number(areaId));
}

export function areaAssignmentValid(area, coordinationId) {
  if (!area) return !coordinationId;
  if (areaRequiresCoordination(area)) return Boolean(coordinationId);
  return !coordinationId;
}

export function documentCodePrefix(area, coordination) {
  if (coordination?.abbreviation) return coordination.abbreviation;
  return area?.abbreviation || '';
}
