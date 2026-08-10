export const AUDITOR_ROLE_ID = 7;
export const GLOBAL_ANALYTICS_ROLE_ID = 9;

const GLOBAL_READ_ROLE_IDS = new Set([
  AUDITOR_ROLE_ID,
  GLOBAL_ANALYTICS_ROLE_ID,
]);

export function hasGlobalReadScope(auth) {
  if (!auth) return false;
  const role = Number(auth.role ?? auth.role_id);
  return auth.perms?.administrar === true || GLOBAL_READ_ROLE_IDS.has(role);
}

export function canIdentifyAnalyticsUsers(auth) {
  if (!auth) return false;
  const role = Number(auth.role ?? auth.role_id);
  return auth.perms?.administrar === true || [2, 8, GLOBAL_ANALYTICS_ROLE_ID].includes(role);
}
