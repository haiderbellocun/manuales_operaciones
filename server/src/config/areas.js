export const OPERATION_ACADEMIC_AREA_ID = 1;
export const GENERAL_COORDINATION_AREA_ID = 9;

export function isGeneralCoordinationArea(areaId) {
  return Number(areaId) === GENERAL_COORDINATION_AREA_ID;
}
