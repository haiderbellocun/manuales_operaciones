import { query } from '../pool.js';
import { getDocument } from './documents.js';

export async function listWorkflow(userId) {
  const { rows } = await query(
    'SELECT * FROM workflow_items ORDER BY since_date DESC',
  );
  const items = await Promise.all(rows.map(async (w) => {
    const doc = await getDocument(w.doc_id, userId);
    return {
      id: w.id,
      docId: w.doc_id,
      stage: w.stage,
      assignee: w.assignee,
      since: w.since_date?.toISOString?.().slice(0, 10) || w.since_date,
      priority: w.priority,
      doc,
    };
  }));
  return items;
}
