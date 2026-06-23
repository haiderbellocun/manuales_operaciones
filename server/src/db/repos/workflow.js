import { pool, query } from '../pool.js';
import { today } from '../mapper.js';
import { getDocument } from './documents.js';
import { logActivity } from './catalog.js';
import { findAreaLeader, findDocumentOwnerRecipient } from './users.js';
import { notifyUsers } from './notifications.js';

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
  const canPublishByRole = authUser.perms?.publicar === true;
  const { rows } = await query(`
    SELECT wi.*, au.name AS assignee_user_name, pu.name AS approver_user_name
    FROM workflow_items wi
    LEFT JOIN users au ON au.id = wi.assignee_user_id
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
  `, [authUserId, canAdmin, canPublishByRole]);

  const items = await Promise.all(rows.map(async (w) => {
    const doc = await getDocument(w.doc_id, authUser);
    const isAssigned = Number(w.assignee_user_id) === authUserId;
    const wasReviewedByMe = Number(w.reviewed_by) === authUserId;
    const wasPublishedByMe = Number(w.completed_by) === authUserId;
    const isOpen = !w.completed_at;
    return {
      id: w.id,
      docId: w.doc_id,
      stage: w.stage,
      assignee: w.assignee_user_name || w.assignee,
      assigneeUserId: w.assignee_user_id,
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
      canSubmitToReview: isOpen && w.stage === 'creacion' && (isAssigned || canAdmin),
      canSendToApproval: isOpen && w.stage === 'revision' && (isAssigned || canAdmin),
      canPublish: isOpen && w.stage === 'aprobacion' && canPublishByRole && (isAssigned || canAdmin),
      canReturn: isOpen && (
        (w.stage === 'revision' && isAssigned)
        || (w.stage === 'aprobacion' && isAssigned && canPublishByRole)
        || (canAdmin && ['revision', 'aprobacion'].includes(w.stage))
      ),
      readOnly: !isAssigned && (wasReviewedByMe || wasPublishedByMe),
      doc,
    };
  }));
  return items;
}

function assertCanAct(workflow, authUser, action) {
  const isAssigned = Number(workflow.assignee_user_id) === Number(authUser.id);
  const canAdmin = authUser.perms?.administrar === true;
  const canPublish = authUser.perms?.publicar === true;

  if (canAdmin) {
    if (action === 'submit' && workflow.stage === 'creacion') return;
    if (action === 'approve' && workflow.stage === 'revision') return;
    if (action === 'publish' && workflow.stage === 'aprobacion' && canPublish) return;
    if (action === 'return' && ['revision', 'aprobacion'].includes(workflow.stage)) return;
  }
  if (action === 'submit' && workflow.stage === 'creacion' && isAssigned) return;
  if (action === 'approve' && workflow.stage === 'revision' && isAssigned) return;
  if (action === 'publish' && workflow.stage === 'aprobacion' && isAssigned && canPublish) return;
  if (action === 'return' && workflow.stage === 'revision' && isAssigned) return;
  if (action === 'return' && workflow.stage === 'aprobacion' && isAssigned && canPublish) return;

  const err = new Error('No tienes permisos para ejecutar esta accion del flujo.');
  err.statusCode = 403;
  throw err;
}

async function getWorkflowForUpdate(client, workflowId) {
  const { rows } = await client.query(`
    SELECT wi.*, d.name AS document_name, d.document_number, d.owner_id, d.area_id, d.version
    FROM workflow_items wi
    JOIN documents d ON d.id = wi.doc_id
    WHERE wi.id = $1 AND wi.completed_at IS NULL
    FOR UPDATE
  `, [Number(workflowId)]);
  return rows[0] || null;
}

export async function transitionWorkflow(workflowId, action, authUser, comments = '') {
  const client = await pool.connect();
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

    assertCanAct(workflow, authUser, action);
    const now = today();

    if (action === 'return') {
      const ownerRecipient = await findDocumentOwnerRecipient(workflow.owner_id, workflow.area_id);
      await client.query(`
        UPDATE documents
        SET state = 'borrador', updated = $2
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
        ownerRecipient?.name || 'Responsable del documento',
        ownerRecipient?.id || null,
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
      result = { status: 'returned', docId: workflow.doc_id };
    } else if (action === 'submit' && workflow.stage === 'creacion') {
      const reviewer = await findAreaLeader(workflow.area_id);
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
            since_date = $4,
            decision = 'submitted_to_review',
            comments = $5
        WHERE id = $1
      `, [
        workflow.id,
        reviewer?.name || 'Revisor asignado',
        reviewer?.id || null,
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
      result = { status: 'submitted_to_review', docId: workflow.doc_id, notify: reviewer?.id ? [reviewer.id] : [] };
    } else if (action === 'approve' && workflow.stage === 'revision') {
      const approverId = workflow.approver_user_id || authUser.id;
      const { rows: approverRows } = await client.query('SELECT name FROM users WHERE id = $1', [approverId]);
      const approverName = approverRows[0]?.name || 'Aprobador asignado';

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
      `, [workflow.id, approverName, approverId, now, comments || null, authUser.id]);
      await client.query(`
        INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
        VALUES ($1, $2, $3, NULL, $4)
      `, [
        workflow.doc_id,
        workflow.version,
        now,
        comments ? `Revision aprobada: ${comments}` : 'Revision aprobada y enviada a aprobacion',
      ]);
      result = { status: 'approved_for_publication', docId: workflow.doc_id, notify: [approverId] };
    } else if (action === 'publish' && workflow.stage === 'aprobacion') {
      await client.query(`
        UPDATE documents
        SET state = 'publicado', updated = $2
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
        comments ? `Publicado: ${comments}` : 'Documento publicado',
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
        action,
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
        title: 'Documento listo para aprobacion',
        message: `${authUser.email} aprobo la revision de "${workflow.document_name}".`,
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
      await notifySafely([owner?.id], {
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
