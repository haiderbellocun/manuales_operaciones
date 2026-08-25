import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useCatalogs } from '../context/CatalogContext';
import { Icon, SelectField, StateBadge } from '../components';
import { fmtDateTime, STATES } from '../utils/display';
import { getErrorToastType, getUserErrorMessage } from '../utils/errors';

const PERIOD_OPTIONS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '365', label: 'Últimos 12 meses' },
  { value: 'all', label: 'Todo el histórico' },
];

const numberFormatter = new Intl.NumberFormat('es-CO');
const formatNumber = value => numberFormatter.format(Number(value || 0));
const ANALYTICS_DETAIL_PAGE_SIZE = 5;

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return 'Sin muestra';
  const total = Number(seconds);
  if (total < 60) return `${Math.max(1, Math.round(total))} s`;
  if (total < 3600) return `${Math.round(total / 60)} min`;
  if (total < 86400) return `${(total / 3600).toFixed(total < 36000 ? 1 : 0)} h`;
  return `${(total / 86400).toFixed(total < 864000 ? 1 : 0)} días`;
}

function formatBucket(value, bucket) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return new Intl.DateTimeFormat('es-CO', bucket === 'month'
    ? { month: 'short', year: '2-digit' }
    : { day: '2-digit', month: 'short' }).format(date);
}

function AnalyticsKpi({ icon, label, value, detail, meta, tone = 'green' }) {
  const displayValue = typeof value === 'string' ? value : formatNumber(value);
  return (
    <article className={`bento-card bento-card-stat bento-stat-${tone}`}>
      <div className="bento-stat-head">
        <span className="bento-stat-label">{label}</span>
        <span className="bento-stat-icon"><Icon name={icon} size={18} /></span>
      </div>
      <div>
        <div className="bento-stat-num">{displayValue}</div>
        <div className="bento-stat-detail">{detail}</div>
      </div>
      {meta && <div className="bento-stat-detail" style={{ opacity: 0.75 }}>{meta}</div>}
    </article>
  );
}

function TrendChart({ data = [], bucket = 'day' }) {
  const width = 820;
  const height = 270;
  const padding = { top: 24, right: 20, bottom: 48, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.flatMap(item => [item.views, item.downloads]), 1);
  const xFor = index => padding.left + ((chartWidth * index) / Math.max(data.length - 1, 1));
  const yFor = value => padding.top + chartHeight - ((Number(value || 0) / maxValue) * chartHeight);
  const pathFor = key => data.map((item, index) => (
    `${index ? 'L' : 'M'} ${xFor(index).toFixed(2)} ${yFor(item[key]).toFixed(2)}`
  )).join(' ');
  const viewsPath = pathFor('views');
  const downloadsPath = pathFor('downloads');
  const viewsArea = data.length
    ? `${viewsPath} L ${xFor(data.length - 1)} ${padding.top + chartHeight} L ${xFor(0)} ${padding.top + chartHeight} Z`
    : '';
  const labelStep = Math.max(1, Math.ceil(data.length / 6));
  const labelIndexes = new Set(data.map((_, index) => index)
    .filter(index => index % labelStep === 0 || index === data.length - 1));

  if (!data.length) {
    return <div className="analytics-empty compact"><Icon name="trend" size={24} /><span>Aún no hay eventos para graficar.</span></div>;
  }

  return (
    <div className="analytics-chart-wrap">
      <svg className="analytics-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia de consultas y descargas">
        <defs>
          <linearGradient id="analyticsViewsFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16734a" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#16734a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding.top + (chartHeight * ratio);
          const label = Math.round(maxValue * (1 - ratio));
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="analytics-chart-grid" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="analytics-chart-axis">{formatNumber(label)}</text>
            </g>
          );
        })}
        {viewsArea && <path d={viewsArea} fill="url(#analyticsViewsFill)" />}
        <path d={viewsPath} className="analytics-chart-line views" />
        <path d={downloadsPath} className="analytics-chart-line downloads" />
        {data.length <= 32 && data.map((item, index) => (
          <g key={item.bucket}>
            <circle cx={xFor(index)} cy={yFor(item.views)} r="3.5" className="analytics-chart-dot views" />
            <circle cx={xFor(index)} cy={yFor(item.downloads)} r="3.5" className="analytics-chart-dot downloads" />
          </g>
        ))}
        {data.map((item, index) => labelIndexes.has(index) && (
          <text key={`label-${item.bucket}`} x={xFor(index)} y={height - 16} textAnchor="middle" className="analytics-chart-axis x">
            {formatBucket(item.bucket, bucket)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function RankingList({ title, subtitle, items = [], icon, tone, nav }) {
  return (
    <section className="card analytics-ranking-card">
      <div className="analytics-card-head">
        <div>
          <span className={`analytics-section-icon ${tone}`}><Icon name={icon} size={17} /></span>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="analytics-ranking-list">
        {items.length ? items.map((item, index) => (
          <button type="button" className="analytics-rank-row" key={item.id} onClick={() => nav('detail', { id: item.id })}>
            <span className={`analytics-rank-position ${index < 3 ? 'top' : ''}`}>{String(index + 1).padStart(2, '0')}</span>
            <span className="analytics-rank-copy">
              <strong>{item.name}</strong>
              <small><span className="mono">{item.documentNumber}</span> · {item.areaAbbreviation}</small>
            </span>
            <span className={`analytics-rank-metric ${tone}`}><Icon name={icon} size={13} />{formatNumber(item.metric)}</span>
          </button>
        )) : <div className="analytics-empty compact"><Icon name={icon} size={22} /><span>Sin interacciones en este período.</span></div>}
      </div>
    </section>
  );
}

function DistributionBars({ title, data = [], color }) {
  const max = Math.max(...data.map(item => item.value), 1);
  return (
    <section className="card analytics-distribution-card">
      <h3>{title}</h3>
      <div className="analytics-distribution-list">
        {data.map(item => (
          <div key={item.id || item.label} className="analytics-distribution-row">
            <div><span>{item.label}</span><strong>{formatNumber(item.value)}</strong></div>
            <div className="analytics-distribution-track"><span style={{ width: `${(item.value / max) * 100}%`, background: item.color || color }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UsageDimensionCard({ title, subtitle, data = [], icon, emptyMessage, note }) {
  const max = Math.max(...data.flatMap(item => [item.views, item.downloads]), 1);
  return (
    <section className="card analytics-usage-card">
      <div className="analytics-card-head">
        <div><span className="analytics-section-icon green"><Icon name={icon} size={17} /></span><h3>{title}</h3><p>{subtitle}</p></div>
      </div>
      <div className="analytics-usage-list">
        {data.length ? data.slice(0, 8).map(item => (
          <div className="analytics-usage-row" key={item.id || item.label}>
            <div className="analytics-usage-label">
              <span style={item.color ? { '--usage-color': item.color } : undefined}>{item.abbreviation || String(item.label).slice(0, 3)}</span>
              <strong title={item.label}>{item.label}</strong>
              <b>{formatNumber(item.views + item.downloads)}</b>
            </div>
            <div className="analytics-usage-bars">
              <span className="views" style={{ width: `${(item.views / max) * 100}%` }} title={`${formatNumber(item.views)} consultas`} />
              <span className="downloads" style={{ width: `${(item.downloads / max) * 100}%` }} title={`${formatNumber(item.downloads)} descargas`} />
            </div>
            <div className="analytics-usage-values"><span><i className="views" />{formatNumber(item.views)} consultas</span><span><i className="downloads" />{formatNumber(item.downloads)} descargas</span></div>
          </div>
        )) : (
          <div className="analytics-empty analytics-dimension-empty">
            <Icon name={icon} size={24} />
            <strong>Fuente de información pendiente</strong>
            <span>{emptyMessage || 'No existen datos para esta dimensión.'}</span>
          </div>
        )}
      </div>
      {note && <div className="analytics-usage-note"><Icon name="alert" size={13} />{note}</div>}
    </section>
  );
}

function useAnalyticsListPagination(items = []) {
  const [page, setPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ANALYTICS_DETAIL_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * ANALYTICS_DETAIL_PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [items]);

  return {
    page: safePage,
    setPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex: Math.min(startIndex + ANALYTICS_DETAIL_PAGE_SIZE, totalItems),
    visibleItems: items.slice(startIndex, startIndex + ANALYTICS_DETAIL_PAGE_SIZE),
  };
}

function AnalyticsListPagination({ id, label, pagination }) {
  if (!pagination.totalItems) return null;
  const pageNumbers = Array.from({ length: pagination.totalPages }, (_, index) => index + 1);
  return (
    <div className="analytics-list-pagination" data-testid={`analytics-pagination-${id}`}>
      <span>{pagination.startIndex + 1}–{pagination.endIndex} de {pagination.totalItems}</span>
      <nav aria-label={`Paginación de ${label}`}>
        <button
          type="button"
          disabled={pagination.page === 1}
          onClick={() => pagination.setPage(pagination.page - 1)}
          aria-label={`Página anterior de ${label}`}
        >
          <Icon name="chevLeft" size={13} />
        </button>
        {pageNumbers.map(pageNumber => (
          <button
            type="button"
            key={pageNumber}
            className={pageNumber === pagination.page ? 'active' : ''}
            onClick={() => pagination.setPage(pageNumber)}
            aria-label={`Página ${pageNumber} de ${label}`}
            aria-current={pageNumber === pagination.page ? 'page' : undefined}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          disabled={pagination.page === pagination.totalPages}
          onClick={() => pagination.setPage(pagination.page + 1)}
          aria-label={`Página siguiente de ${label}`}
        >
          <Icon name="chevRight" size={13} />
        </button>
      </nav>
    </div>
  );
}

function ActiveUsersCard({ users = [], canIdentifyUsers }) {
  const pagination = useAnalyticsListPagination(users);
  return (
    <section className="card analytics-users-card">
      <div className="analytics-card-head"><div><span className="analytics-section-icon purple"><Icon name="users" size={17} /></span><h3>Usuarios más activos</h3><p>Interacciones registradas dentro del período.</p></div></div>
      <div className="analytics-users-list">
        {!canIdentifyUsers ? (
          <div className="analytics-empty compact"><Icon name="shield" size={22} /><span>La identificación de usuarios está restringida para tu rol.</span></div>
        ) : users.length ? pagination.visibleItems.map((user, index) => {
          const position = pagination.startIndex + index + 1;
          return (
          <div className="analytics-user-row" key={user.id}>
            <span className={`analytics-user-position ${position <= 3 ? 'top' : ''}`}>{position}</span>
            <span className="analytics-user-avatar">{String(user.name || 'U').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
            <span className="analytics-user-copy"><strong>{user.name}</strong><small>{formatNumber(user.views)} consultas · {formatNumber(user.downloads)} descargas</small></span>
            <b>{formatNumber(user.interactions)}</b>
          </div>
          );
        }) : <div className="analytics-empty compact"><Icon name="users" size={22} /><span>Aún no hay usuarios con interacciones en este período.</span></div>}
      </div>
      {canIdentifyUsers && <AnalyticsListPagination id="users" label="usuarios más activos" pagination={pagination} />}
    </section>
  );
}

function UnusedDocumentsCard({ items = [], total = 0, nav }) {
  const pagination = useAnalyticsListPagination(items);
  return (
    <section className="card analytics-no-views-card">
      <div className="analytics-card-head"><div><span className="analytics-section-icon amber"><Icon name="alert" size={17} /></span><h3>Documentos sin uso</h3><p>Sin consultas ni descargas registradas.</p></div><span className="analytics-count-pill">{formatNumber(total)}</span></div>
      <div className="analytics-no-views-list">
        {items.length ? pagination.visibleItems.map(item => (
          <button type="button" key={item.id} onClick={() => nav('detail', { id: item.id })}><span style={{ '--area-color': item.areaColor }} /><span><strong>{item.name}</strong><small className="mono">{item.documentNumber} · {item.areaAbbreviation}</small></span><Icon name="arrowRight" size={14} /></button>
        )) : <div className="analytics-empty compact"><Icon name="check" size={22} /><span>Todos los documentos registran alguna interacción.</span></div>}
      </div>
      <AnalyticsListPagination id="unused" label="documentos sin uso" pagination={pagination} />
    </section>
  );
}

function RecentInteractionsCard({ items = [], nav }) {
  const pagination = useAnalyticsListPagination(items);
  return (
    <section className="card analytics-recent-card">
      <div className="analytics-card-head"><div><span className="analytics-section-icon blue"><Icon name="clock" size={17} /></span><h3>Interacciones recientes</h3><p>Últimos eventos registrados en el período.</p></div></div>
      <div className="analytics-recent-list">
        {items.length ? pagination.visibleItems.map(item => (
          <button type="button" key={item.id} onClick={() => nav('detail', { id: item.document.id })}>
            <span className={`analytics-event-icon ${item.type}`}><Icon name={item.type === 'view' ? 'eye' : 'download'} size={14} /></span>
            <span><strong>{item.document.name}</strong><small>{item.userName || 'Identidad protegida'} · {fmtDateTime(item.occurredAt)}</small></span>
            <span className="tag mono">{item.document.areaAbbreviation}</span>
          </button>
        )) : <div className="analytics-empty compact"><Icon name="clock" size={22} /><span>Aún no hay eventos en este período.</span></div>}
      </div>
      <AnalyticsListPagination id="recent" label="interacciones recientes" pagination={pagination} />
    </section>
  );
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportAnalytics(analytics) {
  if (!analytics) return;
  const rows = [
    ['Métrica', 'Valor'],
    ['Período', analytics.period?.label],
    ['Consultas históricas', analytics.totals?.views],
    ['Descargas históricas', analytics.totals?.downloads],
    ['Consultas del período', analytics.totals?.periodViews],
    ['Descargas del período', analytics.totals?.periodDownloads],
    ['Documentos sin consultas', analytics.totals?.withoutViews],
    ['Documentos sin uso', analytics.totals?.withoutUse],
    ['Documentos publicados', analytics.totals?.publishedDocuments],
    ['Tiempo promedio entre consultas', formatDuration(analytics.totals?.averageSecondsBetweenViews)],
    [],
    ['Ranking', 'Documento', 'Código', 'Consultas', 'Descargas', 'Interacciones del período'],
    ...(analytics.ranking || []).map((item, index) => [
      index + 1, item.name, item.documentNumber, item.views, item.downloads, item.metric,
    ]),
    [],
    ['Tendencia mensual (12 meses)', 'Consultas', 'Descargas'],
    ...(analytics.monthlyTrend || []).map(item => [item.bucket, item.views, item.downloads]),
    [],
    ['Uso por área', 'Consultas', 'Descargas'],
    ...(analytics.usageByArea || []).map(item => [item.label, item.views, item.downloads]),
    [],
    ['Uso por categoría documental', 'Consultas', 'Descargas'],
    ...(analytics.usageByCategory || []).map(item => [item.label, item.views, item.downloads]),
    [],
    ['Usuarios más activos', 'Consultas', 'Descargas', 'Interacciones'],
    ...(analytics.topUsers || []).map(item => [item.name, item.views, item.downloads, item.interactions]),
  ];
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `analitica-documental-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportsView({ nav, showToast }) {
  const { areas, coordinations, types } = useCatalogs();
  const [filters, setFilters] = useState({ period: '30', area: 'all', coordination: 'all', type: 'all' });
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const availableCoordinations = useMemo(() => (
    filters.area === 'all'
      ? []
      : coordinations.filter(item => Number(item.areaId) === Number(filters.area))
  ), [coordinations, filters.area]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.getDocumentAnalytics(filters),
      api.getReportSummary(),
    ])
      .then(([usage, repository]) => {
        if (!active) return;
        setAnalytics(usage);
        setSummary(repository);
      })
      .catch((err) => {
        if (!active) return;
        const message = getUserErrorMessage(err, 'No se pudo cargar la analítica documental.');
        setError(message);
        showToast?.({
          title: 'No se pudo cargar la analítica',
          message,
          type: getErrorToastType(err),
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filters]);

  const changeFilter = (key, value) => {
    setFilters(current => ({
      ...current,
      [key]: value,
      ...(key === 'area' ? { coordination: 'all' } : {}),
    }));
  };

  const handleExport = () => {
    try {
      exportAnalytics(analytics);
      showToast?.({
        title: 'Reporte exportado',
        message: 'El archivo CSV con los indicadores documentales comenzó a descargarse.',
        type: 'success',
      });
    } catch (exportError) {
      showToast?.({
        title: 'No se pudo exportar el reporte',
        message: getUserErrorMessage(exportError, 'No fue posible generar el archivo CSV.'),
        type: getErrorToastType(exportError),
      });
    }
  };

  const byState = (summary?.byState || []).map(item => {
    const state = STATES[item.label];
    return { ...item, label: state?.label || item.label, color: state ? `var(--st-${state.cls}-fg)` : undefined };
  });
  const totals = analytics?.totals || {};
  const periodLabel = analytics?.period?.label || 'Período seleccionado';
  const coverage = totals.documents ? Math.round(((totals.documents - totals.withoutViews) / totals.documents) * 100) : 0;
  const allHistory = analytics?.period?.key === 'all';

  return (
    <div className="page fade-in analytics-page">
      <div className="page-head analytics-page-head">
        <div>
          <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Analítica documental</span></div>
          <span className="eyebrow">Métricas de uso</span>
          <h1 className="page-title">Analítica documental</h1>
          <p className="page-sub">Comprende cómo se consulta y utiliza la documentación dentro de tu alcance.</p>
        </div>
        <button className="btn btn-ghost analytics-export" type="button" onClick={handleExport} disabled={!analytics || loading}>
          <Icon name="download" size={16} />Exportar CSV
        </button>
      </div>

      <section className="card analytics-filter-bar" aria-label="Filtros de analítica">
        <div className="analytics-filter-intro"><span><Icon name="report" size={18} /></span><div><strong>Vista analítica</strong><small>Los resultados respetan tus áreas y permisos.</small></div></div>
        <div className="analytics-filter-grid">
          <div><label>Período</label><SelectField value={filters.period} onChange={value => changeFilter('period', value)} options={PERIOD_OPTIONS} /></div>
          <div><label>Área</label><SelectField value={filters.area} onChange={value => changeFilter('area', value)} options={[{ value: 'all', label: 'Todas las áreas' }, ...areas.map(area => ({ value: area.id, label: area.name, color: area.color }))]} /></div>
          {availableCoordinations.length > 0 && (
            <div><label>Subárea</label><SelectField value={filters.coordination} onChange={value => changeFilter('coordination', value)} options={[{ value: 'all', label: 'Todas las subáreas' }, ...availableCoordinations.map(item => ({ value: item.id, label: item.name }))]} /></div>
          )}
          <div><label>Tipo documental</label><SelectField value={filters.type} onChange={value => changeFilter('type', value)} options={[{ value: 'all', label: 'Todos los tipos' }, ...types.map(type => ({ value: type.id, label: type.name, icon: type.icon }))]} /></div>
        </div>
      </section>

      {error && <div className="login-error analytics-error"><Icon name="alert" size={16} />{error}</div>}

      {loading && !analytics ? (
        <div className="card analytics-loading"><span className="spinner" /><strong>Consolidando interacciones documentales…</strong><small>Consultas, descargas y tendencias del período.</small></div>
      ) : analytics && (
        <>
          <div className="bento-grid bento-grid-3" style={{ marginBottom: 'var(--bento-gap)' }}>
            <div className="bento-card bento-card-hero bento-span-3">
              <span className="bento-hero-eyebrow"><Icon name="sparkles" size={13} />Resumen de Rendimiento Documental</span>
              <h2 className="bento-hero-title">
                {formatNumber((totals.views || 0) + (totals.downloads || 0))} interacciones registradas
              </h2>
              <p className="bento-hero-subtitle">
                Cobertura del {coverage}% del acervo consultado durante {periodLabel.toLowerCase()}. Monitorea la actividad y el impacto de los manuales y procedimientos.
              </p>
              <div className="bento-hero-meta">
                <span className="bento-pill bento-pill-green"><Icon name="eye" size={12} />{formatNumber(totals.views)} consultas</span>
                <span className="bento-pill bento-pill-blue"><Icon name="download" size={12} />{formatNumber(totals.downloads)} descargas</span>
                <span className="bento-pill"><Icon name="doc" size={12} />{formatNumber(totals.publishedDocuments)} documentos vigentes</span>
                <span className="bento-pill"><Icon name="users" size={12} />{formatNumber(totals.activeUsers)} usuarios activos</span>
              </div>
            </div>
            <AnalyticsKpi icon="eye" label="Consultas históricas" value={totals.views} detail={`${formatNumber(totals.periodViews)} en ${periodLabel.toLowerCase()}`} meta={`Última: ${fmtDateTime(totals.lastViewedAt)}`} tone="green" />
            <AnalyticsKpi icon="download" label="Descargas históricas" value={totals.downloads} detail={`${formatNumber(totals.periodDownloads)} en ${periodLabel.toLowerCase()}`} meta={`Última: ${fmtDateTime(totals.lastDownloadedAt)}`} tone="blue" />
            <AnalyticsKpi icon="users" label="Usuarios activos" value={totals.activeUsers} detail={`${formatNumber(totals.viewedDocuments)} documentos consultados`} meta="Usuarios únicos en el período" tone="purple" />
            <AnalyticsKpi icon="check" label="Documentos publicados" value={totals.publishedDocuments} detail={`${formatNumber(totals.documents)} documentos dentro del alcance`} meta="Versiones vigentes disponibles" tone="cyan" />
            <AnalyticsKpi icon="clock" label="Intervalo entre consultas" value={formatDuration(totals.averageSecondsBetweenViews)} detail={`${formatNumber(totals.averageIntervalSamples)} intervalos analizados`} meta="Promedio entre consultas" tone="amber" />
            <AnalyticsKpi icon="doc" label="Cobertura documental" value={`${coverage}%`} detail={`${formatNumber(totals.withoutViews)} documentos sin consultas`} meta={`${formatNumber(totals.documents)} documentos analizados`} tone="coral" />
          </div>

          <section className="card analytics-trend-card">
            <div className="analytics-card-head row between wrap gap-12">
              <div><span className="analytics-section-icon green"><Icon name="trend" size={17} /></span><h3>Tendencia mensual</h3><p>Consultas y descargas durante los últimos 12 meses.</p></div>
              <div className="analytics-legend"><span className="views"><i />Consultas</span><span className="downloads"><i />Descargas</span></div>
            </div>
            <TrendChart data={analytics.monthlyTrend || []} bucket="month" />
          </section>

          <section className="analytics-dimensions-section">
            <div className="analytics-subsection-title"><span className="eyebrow">Lectura por dimensión</span><h2>¿Dónde se utiliza la documentación?</h2><p>Comparación de consultas y descargas según las clasificaciones disponibles.</p></div>
            <div className="analytics-dimensions-grid">
              <UsageDimensionCard title="Consultas por área" subtitle={periodLabel} data={analytics.usageByArea} icon="building" />
              <UsageDimensionCard
                title="Consultas por categoría"
                subtitle={`${periodLabel} · agrupación provisional`}
                data={analytics.usageByCategory}
                icon="folder"
                note="Hasta recibir el catálogo institucional de categorías, esta vista utiliza el tipo documental como agrupación provisional."
              />
              <UsageDimensionCard
                title="Consultas por proceso"
                subtitle="Estructura preparada para la fuente institucional"
                data={analytics.usageByProcess}
                icon="flow"
                emptyMessage="El Acervo aún no tiene un catálogo de procesos asociado a los documentos. La tarjeta quedará activa cuando se suministre esa clasificación."
              />
            </div>
          </section>

          <div className="analytics-rankings-grid">
            <RankingList title="Más consultados" subtitle={`Documentos con más visualizaciones · ${periodLabel}`} items={analytics.topViewed} icon="eye" tone="views" nav={nav} />
            <RankingList title="Más descargados" subtitle={`Archivos con más descargas · ${periodLabel}`} items={analytics.topDownloaded} icon="download" tone="downloads" nav={nav} />
          </div>

          <section className="card analytics-table-card">
            <div className="analytics-card-head"><div><span className="analytics-section-icon purple"><Icon name="report" size={17} /></span><h3>Ranking de interacción</h3><p>Ordenado por la suma de consultas y descargas del período.</p></div></div>
            <div className="tbl-wrap">
              <table className="tbl analytics-table">
                <thead><tr><th>Posición</th><th>Documento</th><th>Estado</th><th>Consultas</th><th>Descargas</th><th>Interacciones</th></tr></thead>
                <tbody>
                  {analytics.ranking.length ? analytics.ranking.map((item, index) => (
                    <tr key={item.id} onClick={() => nav('detail', { id: item.id })}>
                      <td><span className={`analytics-table-position ${index < 3 ? 'top' : ''}`}>{index + 1}</span></td>
                      <td><strong>{item.name}</strong><small className="mono">{item.documentNumber} · {item.areaAbbreviation}</small></td>
                      <td><StateBadge state={item.state} /></td>
                      <td><span className="analytics-cell-metric views"><Icon name="eye" size={13} />{formatNumber(allHistory ? item.views : item.periodViews)}</span></td>
                      <td><span className="analytics-cell-metric downloads"><Icon name="download" size={13} />{formatNumber(allHistory ? item.downloads : item.periodDownloads)}</span></td>
                      <td><strong className="mono">{formatNumber(item.metric)}</strong></td>
                    </tr>
                  )) : <tr><td colSpan={6}><div className="analytics-empty compact">Sin interacciones en este período.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="analytics-detail-grid">
            <ActiveUsersCard users={analytics.topUsers} canIdentifyUsers={analytics.canIdentifyUsers} />
            <UnusedDocumentsCard items={analytics.withoutUse} total={totals.withoutUse} nav={nav} />
            <RecentInteractionsCard items={analytics.recent} nav={nav} />
          </div>

          <section className="analytics-tracking-note">
            <Icon name="shield" size={16} />
            <span>{analytics.period.trackingSince
              ? `El detalle histórico por período está disponible desde ${fmtDateTime(analytics.period.trackingSince)}. Los totales conservan los contadores previos existentes.`
              : 'El historial por período comenzará a consolidarse con las nuevas consultas y descargas. Los contadores de consultas existentes se conservan.'}</span>
          </section>

          {summary && (
            <section className="analytics-repository-section">
              <div className="analytics-subsection-title"><span className="eyebrow">Contexto documental</span><h2>Composición del repositorio</h2><p>Distribución de los documentos visibles dentro de tu alcance.</p></div>
              <div className="analytics-distributions-grid">
                <DistributionBars title="Documentos por área" data={summary.byArea || []} />
                <DistributionBars title="Documentos por estado" data={byState} color="var(--brand-500)" />
                <DistributionBars title="Documentos por tipo" data={summary.byType || []} color="var(--st-publicado-fg)" />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
