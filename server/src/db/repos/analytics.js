import { pool, query } from '../pool.js';
import { addDocumentScope } from './catalog.js';
import { canIdentifyAnalyticsUsers } from '../../config/accessRoles.js';

const INTERACTION_TYPES = new Set(['view', 'download']);
const ANALYTICS_TIME_ZONE = 'America/Bogota';
const ANALYTICS_UTC_OFFSET_HOURS = -5;
const PERIODS = {
  7: { days: 7, label: 'Últimos 7 días', bucket: 'day', interval: '1 day' },
  30: { days: 30, label: 'Últimos 30 días', bucket: 'day', interval: '1 day' },
  90: { days: 90, label: 'Últimos 90 días', bucket: 'week', interval: '1 week' },
  365: { days: 365, label: 'Últimos 12 meses', bucket: 'month', interval: '1 month' },
  all: { days: null, label: 'Todo el histórico', bucket: 'month', interval: '1 month' },
};

function normalizedId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function periodConfig(value) {
  const key = String(value || '30');
  return { key: PERIODS[key] ? key : '30', ...(PERIODS[key] || PERIODS[30]) };
}

function periodStart(period) {
  if (!period.days) return null;
  const localCalendar = new Date(Date.now() + (ANALYTICS_UTC_OFFSET_HOURS * 60 * 60 * 1000));
  localCalendar.setUTCDate(localCalendar.getUTCDate() - (period.days - 1));
  const year = localCalendar.getUTCFullYear();
  const month = String(localCalendar.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localCalendar.getUTCDate()).padStart(2, '0');
  return new Date(`${year}-${month}-${day}T00:00:00-05:00`).toISOString();
}

function numberValue(value) {
  return Number(value || 0);
}

function mapRankedDocument(row) {
  return {
    id: row.id,
    documentNumber: row.document_number,
    name: row.name,
    state: row.state,
    area: row.area_id,
    areaName: row.area_name,
    areaAbbreviation: row.area_abbreviation,
    areaColor: row.area_color,
    coordination: row.coordination_id || null,
    type: row.type_id,
    typeName: row.type_name,
    views: numberValue(row.views),
    downloads: numberValue(row.downloads),
    periodViews: numberValue(row.period_views),
    periodDownloads: numberValue(row.period_downloads),
    metric: numberValue(row.metric_value),
    lastViewedAt: row.last_viewed_at || null,
    lastDownloadedAt: row.last_downloaded_at || null,
  };
}

function buildScope(auth, filters = {}) {
  const conditions = [];
  const params = [];
  addDocumentScope(conditions, params, auth, 'd');

  const areaId = normalizedId(filters.area);
  const coordinationId = normalizedId(filters.coordination);
  const typeId = normalizedId(filters.type);
  if (areaId) {
    params.push(areaId);
    conditions.push(`d.area_id = $${params.length}`);
  }
  if (coordinationId) {
    params.push(coordinationId);
    conditions.push(`d.coordination_id = $${params.length}`);
  }
  if (typeId) {
    params.push(typeId);
    conditions.push(`d.type_id = $${params.length}`);
  }

  return {
    params,
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    filters: { area: areaId, coordination: coordinationId, type: typeId },
  };
}

export async function recordDocumentInteraction({
  docId,
  userId = null,
  type,
  version = null,
  source = 'application',
  metadata = {},
}) {
  const documentId = normalizedId(docId);
  const normalizedType = String(type || '').trim().toLowerCase();
  if (!documentId || !INTERACTION_TYPES.has(normalizedType)) {
    const err = new Error('Interacción documental inválida.');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: interactionRows } = await client.query(`
      INSERT INTO document_interactions (
        doc_id, user_id, interaction_type, document_version, source, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, occurred_at
    `, [
      documentId,
      normalizedId(userId),
      normalizedType,
      version ? String(version).slice(0, 20) : null,
      String(source || 'application').slice(0, 40),
      JSON.stringify(metadata || {}),
    ]);
    const interaction = interactionRows[0];

    const counterColumn = normalizedType === 'view' ? 'views' : 'downloads';
    const timestampColumn = normalizedType === 'view' ? 'last_viewed_at' : 'last_downloaded_at';
    const { rows: documentRows } = await client.query(`
      UPDATE documents
      SET ${counterColumn} = ${counterColumn} + 1,
          ${timestampColumn} = $2
      WHERE id = $1
      RETURNING views, downloads, last_viewed_at, last_downloaded_at
    `, [documentId, interaction.occurred_at]);

    if (!documentRows[0]) {
      const err = new Error('Documento no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    await client.query('COMMIT');
    return {
      interactionId: interaction.id,
      type: normalizedType,
      occurredAt: interaction.occurred_at,
      views: numberValue(documentRows[0].views),
      downloads: numberValue(documentRows[0].downloads),
      lastViewedAt: documentRows[0].last_viewed_at || null,
      lastDownloadedAt: documentRows[0].last_downloaded_at || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDocumentAnalytics(auth, filters = {}) {
  const period = periodConfig(filters.period);
  const startAt = periodStart(period);
  const scope = buildScope(auth, filters);
  const scopedDocumentsCte = `
    scoped_docs AS (
      SELECT d.*
      FROM documents d
      ${scope.where}
    )
  `;
  const periodParams = [...scope.params, startAt];
  const startParam = periodParams.length;
  const usageCte = `
    WITH ${scopedDocumentsCte},
    usage_by_doc AS (
      SELECT
        d.id AS doc_id,
        COUNT(i.id) FILTER (WHERE i.interaction_type = 'view')::int AS period_views,
        COUNT(i.id) FILTER (WHERE i.interaction_type = 'download')::int AS period_downloads
      FROM scoped_docs d
      LEFT JOIN document_interactions i
        ON i.doc_id = d.id
       AND ($${startParam}::timestamptz IS NULL OR i.occurred_at >= $${startParam})
      GROUP BY d.id
    )
  `;
  const documentFields = `
    d.id, d.document_number, d.name, d.state, d.area_id, d.coordination_id,
    d.type_id, d.views, d.downloads, d.last_viewed_at, d.last_downloaded_at,
    a.name AS area_name, a.abbreviation AS area_abbreviation, a.color AS area_color,
    dt.name AS type_name,
    usage.period_views, usage.period_downloads
  `;
  const documentFrom = `
    FROM scoped_docs d
    JOIN usage_by_doc usage ON usage.doc_id = d.id
    JOIN areas a ON a.id = d.area_id
    JOIN document_types dt ON dt.id = d.type_id
  `;

  const [
    summaryResult,
    topViewsResult,
    topDownloadsResult,
    rankingResult,
    withoutViewsResult,
    withoutUseResult,
    trendResult,
    recentResult,
    areaUsageResult,
    categoryUsageResult,
    topUsersResult,
    averageIntervalResult,
    monthlyTrendResult,
  ] = await Promise.all([
    query(`
      WITH ${scopedDocumentsCte},
      period_events AS (
        SELECT i.*
        FROM document_interactions i
        JOIN scoped_docs d ON d.id = i.doc_id
        WHERE ($${startParam}::timestamptz IS NULL OR i.occurred_at >= $${startParam})
      )
      SELECT
        (SELECT COUNT(*) FROM scoped_docs)::int AS documents,
        (SELECT COALESCE(SUM(views), 0) FROM scoped_docs)::bigint AS total_views,
        (SELECT COALESCE(SUM(downloads), 0) FROM scoped_docs)::bigint AS total_downloads,
        (SELECT COUNT(*) FROM scoped_docs WHERE views = 0)::int AS without_views,
        (SELECT COUNT(*) FROM scoped_docs WHERE downloads = 0)::int AS without_downloads,
        (SELECT COUNT(*) FROM scoped_docs WHERE views = 0 AND downloads = 0)::int AS without_use,
        (SELECT COUNT(*) FROM scoped_docs WHERE state = 'publicado')::int AS published_documents,
        COUNT(*) FILTER (WHERE interaction_type = 'view')::int AS period_views,
        COUNT(*) FILTER (WHERE interaction_type = 'download')::int AS period_downloads,
        COUNT(DISTINCT doc_id) FILTER (WHERE interaction_type = 'view')::int AS viewed_documents,
        COUNT(DISTINCT doc_id) FILTER (WHERE interaction_type = 'download')::int AS downloaded_documents,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS active_users,
        (SELECT MAX(last_viewed_at) FROM scoped_docs) AS last_viewed_at,
        (SELECT MAX(last_downloaded_at) FROM scoped_docs) AS last_downloaded_at,
        (SELECT MIN(occurred_at) FROM document_interactions i JOIN scoped_docs d ON d.id = i.doc_id) AS tracking_since
      FROM period_events
    `, periodParams),
    query(`
      ${usageCte}
      SELECT ${documentFields},
             CASE WHEN $${startParam}::timestamptz IS NULL THEN d.views ELSE usage.period_views END AS metric_value
      ${documentFrom}
      WHERE (CASE WHEN $${startParam}::timestamptz IS NULL THEN d.views ELSE usage.period_views END) > 0
      ORDER BY metric_value DESC, d.downloads DESC, d.name
      LIMIT 10
    `, periodParams),
    query(`
      ${usageCte}
      SELECT ${documentFields},
             CASE WHEN $${startParam}::timestamptz IS NULL THEN d.downloads ELSE usage.period_downloads END AS metric_value
      ${documentFrom}
      WHERE (CASE WHEN $${startParam}::timestamptz IS NULL THEN d.downloads ELSE usage.period_downloads END) > 0
      ORDER BY metric_value DESC, d.views DESC, d.name
      LIMIT 10
    `, periodParams),
    query(`
      ${usageCte}
      SELECT ${documentFields},
             CASE
               WHEN $${startParam}::timestamptz IS NULL THEN d.views + d.downloads
               ELSE usage.period_views + usage.period_downloads
             END AS metric_value
      ${documentFrom}
      WHERE (
        CASE
          WHEN $${startParam}::timestamptz IS NULL THEN d.views + d.downloads
          ELSE usage.period_views + usage.period_downloads
        END
      ) > 0
      ORDER BY metric_value DESC, d.views DESC, d.name
      LIMIT 10
    `, periodParams),
    query(`
      WITH ${scopedDocumentsCte}
      SELECT d.id, d.document_number, d.name, d.state, d.area_id, d.coordination_id,
             d.type_id, d.views, d.downloads, d.last_viewed_at, d.last_downloaded_at,
             a.name AS area_name, a.abbreviation AS area_abbreviation, a.color AS area_color,
             dt.name AS type_name,
             0::int AS period_views, 0::int AS period_downloads, 0::int AS metric_value
      FROM scoped_docs d
      JOIN areas a ON a.id = d.area_id
      JOIN document_types dt ON dt.id = d.type_id
      WHERE d.views = 0
      ORDER BY d.created DESC NULLS LAST, d.id DESC
      LIMIT 12
    `, scope.params),
    query(`
      WITH ${scopedDocumentsCte}
      SELECT d.id, d.document_number, d.name, d.state, d.area_id, d.coordination_id,
             d.type_id, d.views, d.downloads, d.last_viewed_at, d.last_downloaded_at,
             a.name AS area_name, a.abbreviation AS area_abbreviation, a.color AS area_color,
             dt.name AS type_name,
             0::int AS period_views, 0::int AS period_downloads, 0::int AS metric_value
      FROM scoped_docs d
      JOIN areas a ON a.id = d.area_id
      JOIN document_types dt ON dt.id = d.type_id
      WHERE d.views = 0 AND d.downloads = 0
      ORDER BY d.created DESC NULLS LAST, d.id DESC
      LIMIT 12
    `, scope.params),
    query(`
      WITH ${scopedDocumentsCte},
      scoped_events AS (
        SELECT i.*
        FROM document_interactions i
        JOIN scoped_docs d ON d.id = i.doc_id
        WHERE ($${startParam}::timestamptz IS NULL OR i.occurred_at >= $${startParam})
      ),
      bounds AS (
        SELECT
          date_trunc('${period.bucket}', COALESCE(
            $${startParam}::timestamptz AT TIME ZONE '${ANALYTICS_TIME_ZONE}',
            (SELECT MIN(occurred_at) FROM scoped_events) AT TIME ZONE '${ANALYTICS_TIME_ZONE}',
            NOW() AT TIME ZONE '${ANALYTICS_TIME_ZONE}'
          )) AS start_bucket,
          date_trunc('${period.bucket}', NOW() AT TIME ZONE '${ANALYTICS_TIME_ZONE}') AS end_bucket
      ),
      buckets AS (
        SELECT generate_series(start_bucket, end_bucket, INTERVAL '${period.interval}') AS bucket
        FROM bounds
      )
      SELECT
        bucket AT TIME ZONE '${ANALYTICS_TIME_ZONE}' AS bucket,
        COUNT(events.id) FILTER (WHERE events.interaction_type = 'view')::int AS views,
        COUNT(events.id) FILTER (WHERE events.interaction_type = 'download')::int AS downloads
      FROM buckets
      LEFT JOIN scoped_events events
        ON date_trunc('${period.bucket}', events.occurred_at AT TIME ZONE '${ANALYTICS_TIME_ZONE}') = bucket
      GROUP BY bucket
      ORDER BY bucket
    `, periodParams),
    query(`
      WITH ${scopedDocumentsCte}
      SELECT i.id, i.interaction_type, i.document_version, i.source, i.occurred_at,
             i.user_id, u.name AS user_name,
             d.id AS doc_id, d.document_number, d.name AS document_name,
             a.abbreviation AS area_abbreviation, a.color AS area_color
      FROM document_interactions i
      JOIN scoped_docs d ON d.id = i.doc_id
      JOIN areas a ON a.id = d.area_id
      LEFT JOIN users u ON u.id = i.user_id
      WHERE ($${startParam}::timestamptz IS NULL OR i.occurred_at >= $${startParam})
      ORDER BY i.occurred_at DESC, i.id DESC
      LIMIT 15
    `, periodParams),
    query(`
      ${usageCte}
      SELECT
        a.id,
        a.name AS label,
        a.abbreviation,
        a.color,
        SUM(CASE WHEN $${startParam}::timestamptz IS NULL THEN d.views ELSE usage.period_views END)::bigint AS views,
        SUM(CASE WHEN $${startParam}::timestamptz IS NULL THEN d.downloads ELSE usage.period_downloads END)::bigint AS downloads
      FROM scoped_docs d
      JOIN usage_by_doc usage ON usage.doc_id = d.id
      JOIN areas a ON a.id = d.area_id
      GROUP BY a.id, a.name, a.abbreviation, a.color
      ORDER BY views DESC, downloads DESC, a.name
    `, periodParams),
    query(`
      ${usageCte}
      SELECT
        dt.id,
        dt.name AS label,
        dt.abbreviation,
        dt.icon,
        SUM(CASE WHEN $${startParam}::timestamptz IS NULL THEN d.views ELSE usage.period_views END)::bigint AS views,
        SUM(CASE WHEN $${startParam}::timestamptz IS NULL THEN d.downloads ELSE usage.period_downloads END)::bigint AS downloads
      FROM scoped_docs d
      JOIN usage_by_doc usage ON usage.doc_id = d.id
      JOIN document_types dt ON dt.id = d.type_id
      GROUP BY dt.id, dt.name, dt.abbreviation, dt.icon
      ORDER BY views DESC, downloads DESC, dt.name
    `, periodParams),
    query(`
      WITH ${scopedDocumentsCte}
      SELECT
        i.user_id,
        u.name AS user_name,
        COUNT(*) FILTER (WHERE i.interaction_type = 'view')::int AS views,
        COUNT(*) FILTER (WHERE i.interaction_type = 'download')::int AS downloads,
        COUNT(*)::int AS interactions,
        MAX(i.occurred_at) AS last_interaction_at
      FROM document_interactions i
      JOIN scoped_docs d ON d.id = i.doc_id
      JOIN users u ON u.id = i.user_id
      WHERE i.user_id IS NOT NULL
        AND ($${startParam}::timestamptz IS NULL OR i.occurred_at >= $${startParam})
      GROUP BY i.user_id, u.name
      ORDER BY interactions DESC, views DESC, u.name
      LIMIT 10
    `, periodParams),
    query(`
      WITH ${scopedDocumentsCte},
      ordered_views AS (
        SELECT
          i.doc_id,
          i.occurred_at,
          LAG(i.occurred_at) OVER (PARTITION BY i.doc_id ORDER BY i.occurred_at, i.id) AS previous_view_at
        FROM document_interactions i
        JOIN scoped_docs d ON d.id = i.doc_id
        WHERE i.interaction_type = 'view'
          AND ($${startParam}::timestamptz IS NULL OR i.occurred_at >= $${startParam})
      )
      SELECT
        AVG(EXTRACT(EPOCH FROM (occurred_at - previous_view_at))) AS average_seconds,
        COUNT(*) FILTER (WHERE previous_view_at IS NOT NULL)::int AS sample_size
      FROM ordered_views
      WHERE previous_view_at IS NOT NULL
    `, periodParams),
    query(`
      WITH ${scopedDocumentsCte},
      months AS (
        SELECT generate_series(
          date_trunc('month', NOW() AT TIME ZONE '${ANALYTICS_TIME_ZONE}') - INTERVAL '11 months',
          date_trunc('month', NOW() AT TIME ZONE '${ANALYTICS_TIME_ZONE}'),
          INTERVAL '1 month'
        ) AS bucket
      ),
      events AS (
        SELECT i.*
        FROM document_interactions i
        JOIN scoped_docs d ON d.id = i.doc_id
        WHERE i.occurred_at >= (
          date_trunc('month', NOW() AT TIME ZONE '${ANALYTICS_TIME_ZONE}') - INTERVAL '11 months'
        ) AT TIME ZONE '${ANALYTICS_TIME_ZONE}'
      )
      SELECT
        months.bucket AT TIME ZONE '${ANALYTICS_TIME_ZONE}' AS bucket,
        COUNT(events.id) FILTER (WHERE events.interaction_type = 'view')::int AS views,
        COUNT(events.id) FILTER (WHERE events.interaction_type = 'download')::int AS downloads
      FROM months
      LEFT JOIN events
        ON date_trunc('month', events.occurred_at AT TIME ZONE '${ANALYTICS_TIME_ZONE}') = months.bucket
      GROUP BY months.bucket
      ORDER BY months.bucket
    `, scope.params),
  ]);

  const summaryRow = summaryResult.rows[0] || {};
  const canIdentifyUsers = canIdentifyAnalyticsUsers(auth);
  const isAllHistory = period.key === 'all';

  return {
    period: {
      key: period.key,
      label: period.label,
      days: period.days,
      bucket: period.bucket,
      startAt,
      trackingSince: summaryRow.tracking_since || null,
    },
    filters: scope.filters,
    totals: {
      documents: numberValue(summaryRow.documents),
      views: numberValue(summaryRow.total_views),
      downloads: numberValue(summaryRow.total_downloads),
      periodViews: isAllHistory ? numberValue(summaryRow.total_views) : numberValue(summaryRow.period_views),
      periodDownloads: isAllHistory ? numberValue(summaryRow.total_downloads) : numberValue(summaryRow.period_downloads),
      viewedDocuments: isAllHistory
        ? numberValue(summaryRow.documents) - numberValue(summaryRow.without_views)
        : numberValue(summaryRow.viewed_documents),
      downloadedDocuments: isAllHistory
        ? numberValue(summaryRow.documents) - numberValue(summaryRow.without_downloads)
        : numberValue(summaryRow.downloaded_documents),
      withoutViews: numberValue(summaryRow.without_views),
      withoutDownloads: numberValue(summaryRow.without_downloads),
      withoutUse: numberValue(summaryRow.without_use),
      publishedDocuments: numberValue(summaryRow.published_documents),
      activeUsers: numberValue(summaryRow.active_users),
      averageSecondsBetweenViews: averageIntervalResult.rows[0]?.average_seconds === null
        ? null
        : Math.round(numberValue(averageIntervalResult.rows[0]?.average_seconds)),
      averageIntervalSamples: numberValue(averageIntervalResult.rows[0]?.sample_size),
      lastViewedAt: summaryRow.last_viewed_at || null,
      lastDownloadedAt: summaryRow.last_downloaded_at || null,
    },
    topViewed: topViewsResult.rows.map(mapRankedDocument),
    topDownloaded: topDownloadsResult.rows.map(mapRankedDocument),
    ranking: rankingResult.rows.map(mapRankedDocument),
    withoutViews: withoutViewsResult.rows.map(mapRankedDocument),
    withoutUse: withoutUseResult.rows.map(mapRankedDocument),
    trend: trendResult.rows.map(row => ({
      bucket: row.bucket,
      views: numberValue(row.views),
      downloads: numberValue(row.downloads),
    })),
    recent: recentResult.rows.map(row => ({
      id: row.id,
      type: row.interaction_type,
      version: row.document_version || null,
      source: row.source,
      occurredAt: row.occurred_at,
      userId: canIdentifyUsers ? row.user_id : null,
      userName: canIdentifyUsers ? (row.user_name || 'Usuario no disponible') : null,
      document: {
        id: row.doc_id,
        documentNumber: row.document_number,
        name: row.document_name,
        areaAbbreviation: row.area_abbreviation,
        areaColor: row.area_color,
      },
    })),
    usageByArea: areaUsageResult.rows.map(row => ({
      id: row.id,
      label: row.label,
      abbreviation: row.abbreviation,
      color: row.color,
      views: numberValue(row.views),
      downloads: numberValue(row.downloads),
    })),
    usageByCategory: categoryUsageResult.rows.map(row => ({
      id: row.id,
      label: row.label,
      abbreviation: row.abbreviation,
      icon: row.icon,
      views: numberValue(row.views),
      downloads: numberValue(row.downloads),
    })),
    usageByProcess: [],
    dimensionSources: {
      category: 'document_type_provisional',
      process: 'catalog_pending',
    },
    topUsers: canIdentifyUsers ? topUsersResult.rows.map(row => ({
      id: row.user_id,
      name: row.user_name,
      views: numberValue(row.views),
      downloads: numberValue(row.downloads),
      interactions: numberValue(row.interactions),
      lastInteractionAt: row.last_interaction_at || null,
    })) : [],
    monthlyTrend: monthlyTrendResult.rows.map(row => ({
      bucket: row.bucket,
      views: numberValue(row.views),
      downloads: numberValue(row.downloads),
    })),
    canIdentifyUsers,
  };
}
