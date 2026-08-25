import { hasGlobalReadScope } from '../config/accessRoles.js';
import {
  GENERAL_COORDINATION_AREA_ID,
  OPERATION_ACADEMIC_AREA_ID,
} from '../config/areas.js';

const OPERATION_ACADEMIC_FULL_ROLE_ID = 8;

/**
 * Restringe documentos por rol/área.
 * Los marcados con visible_to_all y publicados son visibles para cualquier rol.
 */
export function addDocumentScope(conditions, params, auth, alias = 'documents') {
  if (!auth) return;

  const role = Number(auth.role ?? auth.role_id);
  const userId = Number(auth.id);
  const areaId = (auth.area ?? auth.area_id) ? Number(auth.area ?? auth.area_id) : null;
  const coordinationId = (auth.coordination ?? auth.coordination_id)
    ? Number(auth.coordination ?? auth.coordination_id)
    : null;
  const col = (name) => `${alias}.${name}`;
  const visibleToAllPublished = () => (
    `(${col('visible_to_all')} = true AND ${col('state')} = 'publicado')`
  );
  const generalParticipation = () => {
    params.push(userId);
    const userParam = params.length;
    return `(
      ${col('area_id')} = ${GENERAL_COORDINATION_AREA_ID}
      AND (
        EXISTS (
          SELECT 1 FROM document_files scope_df
          WHERE scope_df.doc_id = ${col('id')}
            AND scope_df.uploaded_by = $${userParam}
        )
        OR EXISTS (
          SELECT 1 FROM activity_log scope_al
          WHERE scope_al.doc_id = ${col('id')}
            AND scope_al.who_user_id = $${userParam}
            AND scope_al.event_type = 'document_created'
        )
        OR EXISTS (
          SELECT 1 FROM workflow_items scope_wi
          WHERE scope_wi.doc_id = ${col('id')}
            AND (
              scope_wi.assignee_user_id = $${userParam}
              OR scope_wi.reviewer_user_id = $${userParam}
              OR scope_wi.approver_user_id = $${userParam}
              OR scope_wi.reviewed_by = $${userParam}
              OR scope_wi.completed_by = $${userParam}
            )
        )
      )
    )`;
  };

  if (hasGlobalReadScope(auth)) return;

  if (role === 2 || role === 3 || role === OPERATION_ACADEMIC_FULL_ROLE_ID) {
    if (!areaId) {
      conditions.push(visibleToAllPublished());
      return;
    }
    params.push(areaId);
    const areaParam = params.length;
    let areaCondition = `${col('area_id')} = $${areaParam}`;
    if (coordinationId && areaId !== OPERATION_ACADEMIC_AREA_ID) {
      params.push(coordinationId);
      areaCondition += ` AND ${col('coordination_id')} = $${params.length}`;
    }
    conditions.push(`(
      (${areaCondition})
      OR ${generalParticipation()}
      OR ${visibleToAllPublished()}
    )`);
    return;
  }

  if (role === 4) {
    params.push(userId);
    const userParam = params.length;
    const workflowCondition = `EXISTS (
      SELECT 1 FROM workflow_items wi
      WHERE wi.doc_id = ${col('id')}
        AND (
          wi.assignee_user_id = $${userParam}
          OR wi.reviewed_by = $${userParam}
          OR wi.completed_by = $${userParam}
        )
    )`;
    if (areaId) {
      params.push(areaId);
      const areaParam = params.length;
      conditions.push(`(
        ${col('area_id')} = $${areaParam}
        OR ${workflowCondition}
        OR ${visibleToAllPublished()}
      )`);
    } else {
      conditions.push(`(${workflowCondition} OR ${visibleToAllPublished()})`);
    }
    return;
  }

  if (role === 5) {
    params.push(userId);
    const userParam = params.length;
    const workflowCondition = `EXISTS (
      SELECT 1 FROM workflow_items wi
      WHERE wi.doc_id = ${col('id')}
        AND (
          wi.assignee_user_id = $${userParam}
          OR wi.completed_by = $${userParam}
        )
    )`;
    if (areaId === OPERATION_ACADEMIC_AREA_ID) {
      params.push(areaId);
      const areaParam = params.length;
      conditions.push(`(
        ${col('area_id')} = $${areaParam}
        OR ${workflowCondition}
        OR ${visibleToAllPublished()}
      )`);
    } else {
      conditions.push(`(${workflowCondition} OR ${visibleToAllPublished()})`);
    }
    return;
  }

  params.push('publicado');
  const stateParam = params.length;
  const publishedCondition = `${col('state')} = $${stateParam}`;
  conditions.push(auth.perms?.crear === true
    ? `(${publishedCondition} OR ${generalParticipation()})`
    : publishedCondition);
}

export function parseVisibleToAll(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'on', 'yes', 'si', 'sí'].includes(normalized)) return true;
    if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  }
  return fallback;
}
