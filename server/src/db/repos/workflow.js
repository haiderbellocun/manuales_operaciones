import { pool, query } from '../pool.js';
import { today } from '../mapper.js';
import { getDocument } from './documents.js';
import { logActivity } from './catalog.js';
import { findAreaReviewer, findDocumentOwnerRecipient } from './users.js';
import { notifyUsers } from './notifications.js';
import {
  APPROVER_ROLE_IDS,
  REVIEWER_ROLE_IDS,
  isApproverRole,
  isReviewerRole,
} from '../../config/workflowRoles.js';

function fmtDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function notifySafely(recipients, payload) {
  try {
    await notifyUsers(recipients, payload);
  } catch (err) {
    console.error('No se pudo crear/enviar notificacion de workflow:', err.message);
  }
}

export async function listWorkflow(authUser) {
  const authUserId = Number(authUser.id);
  const canAdmin = authUser.perms?.administrar === true;
  const authRole = Number(authUser.role ?? authUser.role_id);
  const canActAsReviewer = isReviewerRole(authRole);
  const canActAsApprover = isApproverRole(authRole);
  const canApproveAndPublish = canActAsApprover
    && authUser.perms?.aprobar === true
    && authUser.perms?.publicar === true;
  const { rows } = await query(`
    SELECT wi.*, au.name AS assignee_user_name, ru.name AS reviewer_user_name,
           pu.name AS approver_user_name
    FROM workflow_items wi
    LEFT JOIN users au ON au.id = wi.assignee_user_id
    LEFT JOIN users ru ON ru.id = wi.reviewer_user_id
    LEFT JOIN users pu ON pu.id = wi.approver_user_id
    WHERE (
      $2::boolean = TRUE
      AND wi.completed_at IS NULL
    ) OR (
      wi.assignee_user_id = $1
      AND wi.stage IN ('creacion', 'revision')
      AND wi.completed_at IS NULL
    ) OR (
      wi.assignee_user_id = $1
      AND wi.stage = 'aprobacion'
      AND wi.completed_at IS NULL
      AND $3::boolean = TRUE
    ) OR (
      wi.reviewed_by = $1
      AND wi.stage = 'aprobacion'
    ) OR (
      wi.completed_by = $1
      AND wi.decision = 'published'
    )
    ORDER BY wi.since_date DESC, wi.id DESC
  `, [authUserId, canAdmin, canActAsApprover]);

  const items = await Promise.all(rows.map(async (w) => {
    const doc = await getDocument(w.doc_id, authUser);
    const isAssigned = Number(w.assignee_user_id) === authUserId;
    const wasReviewedByMe = Number(w.reviewed_by) === authUserId;
    const wasPublishedByMe = Number(w.completed_by) === authUserId;
    const isOpen = !w.completed_at;
    const isReviewerAssignment = isAssigned
      && Number(w.reviewer_user_id) === authUserId
      && Number(authUser.area ?? authUser.area_id) === Number(doc?.area);
    const isApproverAssignment = isAssigned
      && Number(w.approver_user_id) === authUserId
      && Number(authUser.area ?? authUser.area_id) === Number(doc?.area);
    const canMarkApproved = isOpen
      && w.stage === 'revision'
      && isReviewerAssignment
      && canActAsReviewer;
    return {
      id: w.id,
      docId: w.doc_id,
      stage: w.stage,
      assignee: w.assignee_user_name || w.assignee,
      assigneeUserId: w.assignee_user_id,
      reviewerUserId: w.reviewer_user_id,
      reviewerName: w.reviewer_user_name,
      approverUserId: w.approver_user_id,
      approverName: w.approver_user_name,
      since: fmtDate(w.since_date),
      priority: w.priority,
      decision: w.decision,
      comments: w.comments,
      completedAt: fmtDate(w.completed_at),
      completedBy: w.completed_by,
      reviewedAt: fmtDate(w.reviewed_at),
      reviewedBy: w.reviewed_by,
      canSubmitToReview: isOpen
        && w.stage === 'creacion'
        && isAssigned
        && authUser.perms?.crear === true,
      canMarkApproved,
      // Alias temporal para frontends desplegados antes del cambio de nombre.
      canSendToApproval: canMarkApproved,
      canPublish: isOpen
        && w.stage === 'aprobacion'
        && isApproverAssignment
        && canApproveAndPublish,
      canReturn: isOpen && (
        (w.stage === 'revision' && isReviewerAssignment && canActAsReviewer)
        || (w.stage === 'aprobacion' && isApproverAssignment && canApproveAndPublish)
      ),
      readOnly: !isAssigned || wasReviewedByMe || wasPublishedByMe,
      doc,
    };
  }));
  return items;
}

function assertCanAct(workflow, authUser, action) {
  const isAssigned = Number(workflow.assignee_user_id) === Number(authUser.id);
  const role = Number(authUser.role ?? authUser.role_id);
  const isSameArea = Number(authUser.area ?? authUser.area_id) === Number(workflow.area_id);
  const isAssignedReviewer = isAssigned
    && Number(workflow.reviewer_user_id) === Number(authUser.id)
    && isSameArea;
  const isAssignedApprover = isAssigned
    && Number(workflow.approver_user_id) === Number(authUser.id)
    && isSameArea;
  const canActAsReviewer = isReviewerRole(role);
  const canApproveAndPublish = isApproverRole(role)
    && authUser.perms?.aprobar === true
    && authUser.perms?.publicar === true;

  if (
    action === 'submit'
    && workflow.stage === 'creacion'
    && isAssigned
    && authUser.perms?.crear === true
  ) return;
  if (
    action === 'review'
    && workflow.stage === 'revision'
    && isAssignedReviewer
    && canActAsReviewer
  ) return;
  if (
    action === 'publish'
    && workflow.stage === 'aprobacion'
    && isAssignedApprover
    && canApproveAndPublish
  ) return;
  if (
    action === 'return'
    && workflow.stage === 'revision'
    && isAssignedReviewer
    && canActAsReviewer
  ) return;
  if (
    action === 'return'
    && workflow.stage === 'aprobacion'
    && isAssignedApprover
    && canApproveAndPublish
  ) return;

  const err = new Error('No tienes permisos para ejecutar esta accion del flujo.');
  err.statusCode = 403;
  throw err;
}

async function getWorkflowForUpdate(client, workflowId) {
  const { rows } = await client.query(`
    SELECT wi.*, d.name AS document_name, d.document_number, d.owner_id, d.area_id, d.version,
           df.uploaded_by AS creator_user_id
    FROM workflow_items wi
    JOIN documents d ON d.id = wi.doc_id
    LEFT JOIN document_files df ON df.doc_id = d.id
    WHERE wi.id = $1 AND wi.completed_at IS NULL
    FOR UPDATE OF wi, d
  `, [Number(workflowId)]);
  return rows[0] || null;
}

export async function transitionWorkflow(workflowId, action, authUser, comments = '') {
  const client = await pool.connect();
  const normalizedAction = action === 'approve' ? 'review' : action;
  let result;
  let committed = false;

  try {
    await client.query('BEGIN');
    const workflow = await getWorkflowForUpdate(client, workflowId);
    if (!workflow) {
      const err = new Error('Elemento de flujo no encontrado o ya finalizado.');
      err.statusCode = 404;
      throw err;
    }

    assertCanAct(workflow, authUser, normalizedAction);
    const now = today();

    if (normalizedAction === 'return') {
      let ownerRecipient = await findDocumentOwnerRecipient(workflow.owner_id, workflow.area_id);
      if (!ownerRecipient && workflow.creator_user_id) {
        const { rows: creatorRows } = await client.query(`
          SELECT id, name
          FROM users
          WHERE id = $1 AND status = 'Activo'
          LIMIT 1
        `, [workflow.creator_user_id]);
        ownerRecipient = creatorRows[0] || null;
      }
      if (!ownerRecipient) {
        const err = new Error('No hay un responsable activo para recibir el documento devuelto.');
        err.statusCode = 409;
        throw err;
      }
      await client.query(`
        UPDATE documents
        SET state = 'borrador', updated = $2, published_at = NULL
        WHERE id = $1
      `, [workflow.doc_id, now]);
      await client.query(`
        UPDATE workflow_items
        SET stage = 'creacion',
            assignee = $2,
            assignee_user_id = $3,
            since_date = $4,
            decision = 'returned',
            comments = $5
        WHERE id = $1
      `, [
        workflow.id,
        ownerRecipient.name,
        ownerRecipient.id,
        now,
        comments || null,
      ]);
      await client.query(`
        INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
        VALUES ($1, $2, $3, NULL, $4)
      `, [
        workflow.doc_id,
        workflow.version,
        now,
        comments ? `Devuelto en flujo: ${comments}` : 'Devuelto en flujo para ajustes',
      ]);
      result = { status: 'returned', docId: workflow.doc_id, notify: [ownerRecipient.id] };
    } else if (normalizedAction === 'submit' && workflow.stage === 'creacion') {
      let reviewer = null;
      if (workflow.reviewer_user_id) {
        const { rows: reviewerRows } = await client.query(`
          SELECT id, name
          FROM users
          WHERE id = $1
            AND role_id = ANY($2::int[])
            AND area_id = $3
            AND status = 'Activo'
          LIMIT 1
        `, [workflow.reviewer_user_id, REVIEWER_ROLE_IDS, workflow.area_id]);
        reviewer = reviewerRows[0] || null;
      }
      if (!reviewer) reviewer = await findAreaReviewer(workflow.area_id);
      if (!reviewer) {
        const err = new Error('El documento no tiene un revisor activo y habilitado asignado.');
        err.statusCode = 409;
        throw err;
      }
      await client.query(`
        UPDATE documents
        SET state = 'revision', updated = $2
        WHERE id = $1
      `, [workflow.doc_id, now]);
      await client.query(`
        UPDATE workflow_items
        SET stage = 'revision',
             assignee = $2,
             assignee_user_id = $3,
             reviewer_user_id = $3,
             since_date = $4,
            decision = 'submitted_to_review',
            comments = $5
        WHERE id = $1
      `, [
        workflow.id,
        reviewer.name,
        reviewer.id,
        now,
        comments || null,
      ]);
      await client.query(`
        INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
        VALUES ($1, $2, $3, NULL, $4)
      `, [
        workflow.doc_id,
        workflow.version,
        now,
        comments ? `Enviado a revision: ${comments}` : 'Borrador enviado a revision',
      ]);
      result = { status: 'submitted_to_review', docId: workflow.doc_id, notify: [reviewer.id] };
    } else if (normalizedAction === 'review' && workflow.stage === 'revision') {
      const { rows: approverRows } = await client.query(`
        SELECT id, name
        FROM users
        WHERE id = $1
          AND role_id = ANY($2::int[])
          AND area_id = $3
          AND status = 'Activo'
        LIMIT 1
      `, [workflow.approver_user_id, APPROVER_ROLE_IDS, workflow.area_id]);
      const approver = approverRows[0] || null;
      if (!approver) {
        const err = new Error('El documento no tiene un aprobador activo y habilitado asignado.');
        err.statusCode = 409;
        throw err;
      }

      await client.query(`
        UPDATE documents
        SET state = 'aprobado', updated = $2
        WHERE id = $1
      `, [workflow.doc_id, now]);
      await client.query(`
        UPDATE workflow_items
        SET stage = 'aprobacion',
            assignee = $2,
            assignee_user_id = $3,
            since_date = $4,
            decision = 'review_approved',
            comments = $5,
            reviewed_at = NOW(),
            reviewed_by = $6
        WHERE id = $1
      `, [workflow.id, approver.name, approver.id, now, comments || null, authUser.id]);
      await client.query(`
        INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
        VALUES ($1, $2, $3, NULL, $4)
      `, [
        workflow.doc_id,
        workflow.version,
        now,
        comments ? `Revision aprobada: ${comments}` : 'El revisor marco el documento como aprobado',
      ]);
      result = { status: 'approved_for_publication', docId: workflow.doc_id, notify: [approver.id] };
    } else if (normalizedAction === 'publish' && workflow.stage === 'aprobacion') {
      await client.query(`
        UPDATE documents
        SET state = 'publicado', updated = $2, published_at = NOW()
        WHERE id = $1
      `, [workflow.doc_id, now]);
      await client.query(`
        UPDATE workflow_items
        SET completed_at = NOW(),
            completed_by = $2,
            decision = 'published',
            comments = $3
        WHERE id = $1
      `, [workflow.id, authUser.id, comments || null]);
      await client.query(`
        INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
        VALUES ($1, $2, $3, NULL, $4)
      `, [
        workflow.doc_id,
        workflow.version,
        now,
        comments ? `Aprobado y publicado: ${comments}` : 'Documento aprobado y publicado por el aprobador',
      ]);
      result = { status: 'published', docId: workflow.doc_id };
    } else {
      const err = new Error('Accion no valida para la etapa actual del flujo.');
      err.statusCode = 400;
      throw err;
    }

    await client.query('COMMIT');
    committed = true;

    await logActivity(authUser.id, `Flujo documental: ${result.status}`, workflow.doc_id, {
      eventType: 'workflow_transition',
      details: {
        action: normalizedAction,
        status: result.status,
        previousStage: workflow.stage,
        comments: comments || null,
        workflowId: workflow.id,
      },
    });
    const owner = await findDocumentOwnerRecipient(workflow.owner_id, workflow.area_id);
    if (result.status === 'submitted_to_review') {
      await notifySafely(result.notify, {
        title: 'Documento enviado a revision',
        message: `${authUser.email} envio "${workflow.document_name}" a revision.`,
        type: 'workflow',
        docId: workflow.doc_id,
      });
    } else if (result.status === 'approved_for_publication') {
      await notifySafely(result.notify, {
        title: 'Documento aprobado en revision',
        message: `${authUser.email} marco "${workflow.document_name}" como aprobado y listo para publicacion.`,
        type: 'workflow',
        docId: workflow.doc_id,
      });
    } else if (result.status === 'published') {
      await notifySafely([owner?.id], {
        title: 'Documento publicado',
        message: `"${workflow.document_name}" fue publicado en Acervo Operaciones.`,
        type: 'workflow',
        docId: workflow.doc_id,
      });
    } else if (result.status === 'returned') {
      await notifySafely(result.notify, {
        title: 'Documento devuelto para ajustes',
        message: `"${workflow.document_name}" fue devuelto en el flujo de aprobacion.`,
        type: 'update_request',
        docId: workflow.doc_id,
      });
    }

    return result;
  } catch (err) {
    if (!committed) {
      await client.query('ROLLBACK');
    }
    throw err;
  } finally {
    client.release();
  }
}
