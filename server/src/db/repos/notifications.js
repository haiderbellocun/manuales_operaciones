import { query } from '../pool.js';
import { sendNotificationEmail } from '../../services/mailer.js';

function mapNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    docId: row.doc_id,
    docNumber: row.document_number,
    docName: row.document_name,
    read: Boolean(row.read_at),
    readAt: row.read_at,
    createdAt: row.created_at,
    emailStatus: row.email_status,
    emailError: row.email_error,
    emailedAt: row.emailed_at,
  };
}

async function markEmailStatus(id, status, error = null) {
  await query(`
    UPDATE notifications
    SET email_status = $2::varchar,
        email_error = $3::text,
        emailed_at = CASE WHEN $2::varchar = 'sent' THEN NOW() ELSE emailed_at END
    WHERE id = $1
  `, [id, status, error]);
}

async function deliverEmail(notificationId) {
  const { rows } = await query(`
    SELECT n.*, u.email, u.name AS user_name, d.document_number
    FROM notifications n
    JOIN users u ON u.id = n.user_id
    LEFT JOIN documents d ON d.id = n.doc_id
    WHERE n.id = $1
  `, [notificationId]);
  const row = rows[0];
  if (!row) return;

  try {
    await sendNotificationEmail({
      to: row.email,
      name: row.user_name,
      title: row.title,
      message: row.message,
      docNumber: row.document_number,
    });
    await markEmailStatus(notificationId, 'sent');
  } catch (err) {
    await markEmailStatus(notificationId, 'failed', err.message);
  }
}

export async function createNotification({
  userId,
  title,
  message,
  type = 'info',
  docId = null,
  sendEmail = true,
}) {
  const { rows } = await query(`
    INSERT INTO notifications (user_id, title, message, type, doc_id, email_status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    Number(userId),
    title,
    message,
    type,
    docId ? Number(docId) : null,
    sendEmail ? 'pending' : 'skipped',
  ]);

  if (sendEmail) {
    await deliverEmail(rows[0].id);
  }

  return getNotification(rows[0].id);
}

export async function notifyUsers(userIds, payload) {
  const uniqueIds = [...new Set((userIds || []).map(Number).filter(Boolean))];
  const results = [];
  for (const userId of uniqueIds) {
    results.push(await createNotification({ ...payload, userId }));
  }
  return results;
}

export async function getNotification(id) {
  const { rows } = await query(`
    SELECT n.*, d.document_number, d.name AS document_name
    FROM notifications n
    LEFT JOIN documents d ON d.id = n.doc_id
    WHERE n.id = $1
  `, [Number(id)]);
  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function listNotifications(userId, limit = 30) {
  const { rows } = await query(`
    SELECT n.*, d.document_number, d.name AS document_name
    FROM notifications n
    LEFT JOIN documents d ON d.id = n.doc_id
    WHERE n.user_id = $1
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT $2
  `, [Number(userId), Math.min(100, Math.max(1, Number(limit) || 30))]);
  return rows.map(mapNotification);
}

export async function countUnreadNotifications(userId) {
  const { rows } = await query(`
    SELECT COUNT(*)::int AS total
    FROM notifications
    WHERE user_id = $1 AND read_at IS NULL
  `, [Number(userId)]);
  return rows[0].total;
}

export async function markNotificationRead(userId, id) {
  const { rows } = await query(`
    UPDATE notifications
    SET read_at = COALESCE(read_at, NOW())
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [Number(id), Number(userId)]);
  return rows.length > 0;
}

export async function markAllNotificationsRead(userId) {
  await query(`
    UPDATE notifications
    SET read_at = COALESCE(read_at, NOW())
    WHERE user_id = $1 AND read_at IS NULL
  `, [Number(userId)]);
}
