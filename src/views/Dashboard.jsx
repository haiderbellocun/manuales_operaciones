import { useMemo, useState, useEffect } from 'react';
import { api } from '../services/api';
import { Icon, StateBadge, AreaTag, KpiCard } from '../components';
import { useCatalogs } from '../context/CatalogContext';
import { STATES, fmtDate } from '../utils/display';

export function Dashboard({ nav, docs, userName = 'Usuario' }) {
  const [activity, setActivity] = useState([]);
  const [recentPage, setRecentPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const { areas, typeById } = useCatalogs();
  const pageSize = 6;

  useEffect(() => {
    api.getActivity().then(setActivity).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const total = docs.length;
    const vigentes = docs.filter(d => ['publicado', 'aprobado'].includes(d.state)).length;
    const revision = docs.filter(d => d.state === 'revision').length;
    const vencidos = docs.filter(d => d.state === 'vencido').length;
    const borradores = docs.filter(d => d.state === 'borrador').length;
    return { total, vigentes, revision, vencidos, borradores };
  }, [docs]);

  const allRecientes = useMemo(() => [...docs].sort((a, b) => b.updated.localeCompare(a.updated)), [docs]);
  const recentPages = Math.max(1, Math.ceil(allRecientes.length / pageSize));
  const recientes = useMemo(() => allRecientes.slice((recentPage - 1) * pageSize, recentPage * pageSize), [allRecientes, recentPage]);
  const masConsultados = useMemo(() => [...docs].sort((a, b) => b.views - a.views).slice(0, 5), [docs]);
  const pendientes = useMemo(() => docs.filter(d => d.state === 'vencido' || d.state === 'revision').sort((a, b) => a.vigencia.localeCompare(b.vigencia)).slice(0, 5), [docs]);
  const areaCounts = areas.map(a => ({ ...a, count: docs.filter(d => Number(d.area) === Number(a.id)).length, vencidos: docs.filter(d => Number(d.area) === Number(a.id) && d.state === 'vencido').length }));
  const activityPages = Math.max(1, Math.ceil(activity.length / pageSize));
  const visibleActivity = useMemo(() => activity.slice((activityPage - 1) * pageSize, activityPage * pageSize), [activity, activityPage]);

  useEffect(() => {
    setRecentPage(1);
  }, [docs.length]);

  useEffect(() => {
    setActivityPage(1);
  }, [activity.length]);

  const Pager = ({ page, pages, onPage, total }) => {
    if (pages <= 1) return <span className="text-xs muted">{total} registros</span>;
    return (
      <div className="dashboard-pager">
        <button type="button" className="tbar-icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
          <Icon name="chevLeft" size={15} />
        </button>
        <span className="text-xs muted mono">{page}/{pages}</span>
        <button type="button" className="tbar-icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Página siguiente">
          <Icon name="chevRight" size={15} />
        </button>
      </div>
    );
  };

  return (
    <div className="page fade-in">
      <div className="dashboard-hero">
        <div className="card hero-card">
          <div className="hero-bg-circle hero-bg-circle-1"></div>
          <div className="hero-bg-circle hero-bg-circle-2"></div>
          <div>
            <div className="eyebrow hero-eyebrow">Centro de Conocimiento Operativo</div>
            <h1 className="hero-title">Buenos días, {userName}</h1>
            <p className="hero-desc">El repositorio vivo del Área de Operaciones. Toda la documentación operativa, centralizada, trazable y siempre a la mano.</p>
          </div>
          <div className="row gap-10 hero-actions">
            <button className="btn hero-btn-primary" onClick={() => nav('upload')}><Icon name="upload" size={16} />Cargar documento</button>
            <button className="btn hero-btn-secondary" onClick={() => nav('search')}><Icon name="sparkles" size={16} />Buscador inteligente</button>
          </div>
        </div>

        <div className="card attention-card">
          <div className="row between mb-16">
            <h3 className="section-title" style={{ margin: 0 }}>Requieren tu atención</h3>
            <span className="badge badge-vencido"><span className="b-dot"></span>{stats.vencidos + stats.revision}</span>
          </div>
          <div className="attention-list">
            {pendientes.slice(0, 4).map(d => (
              <div key={d.id} className="attention-item" onClick={() => nav('detail', { id: d.id })} role="button" tabIndex={0}>
                <span className={'attention-icon ' + (d.state === 'vencido' ? 'tone-red' : 'tone-amber')}>
                  <Icon name={d.state === 'vencido' ? 'alert' : 'clock'} size={16} />
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="attention-name">{d.name}</div>
                  <div className="mono text-xs muted">{d.documentNumber} · vence {fmtDate(d.vigencia)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="link mt-16" onClick={() => nav('workflow')}>Ver flujo de revisión →</div>
        </div>
      </div>

      <div className="grid-kpi mb-24">
        <KpiCard icon="doc" value={stats.total} label="Documentos totales" tone="brand" />
        <KpiCard icon="check" value={stats.vigentes} label="Vigentes (aprob./publicados)" tone="brand" />
        <KpiCard icon="clock" value={stats.revision} label="En revisión" tone="amber" />
        <KpiCard icon="alert" value={stats.vencidos} label="Vencidos" tone="red" />
        <KpiCard icon="edit" value={stats.borradores} label="Borradores" tone="gray" />
      </div>

      <h3 className="section-title">Accesos por área
        <span className="link" onClick={() => nav('library')}>Ver biblioteca completa →</span>
      </h3>
      <div className="area-grid">
        {areaCounts.map(a => (
          <div key={a.id} className="card area-card" onClick={() => nav('library', { area: a.id })} role="button" tabIndex={0}>
            <div className="row between">
              <span className="kpi-ico area-icon" style={{ background: a.color, color: '#fff' }}><Icon name="building" size={19} /></span>
              {a.vencidos > 0 && <span className="badge badge-vencido" style={{ fontSize: 11 }}>{a.vencidos} vencido{a.vencidos > 1 ? 's' : ''}</span>}
            </div>
            <div className="area-name">{a.name}</div>
            <div className="row between mt-8">
              <span className="mono text-xs muted">{a.abbreviation}</span>
              <span className="area-count">{a.count} documentos</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="row between mb-16">
            <h3 className="section-title" style={{ margin: 0 }}>Documentos recientes</h3>
            <Pager page={recentPage} pages={recentPages} total={allRecientes.length} onPage={setRecentPage} />
          </div>
          <div className="doc-list">
            {recientes.map((d, i) => {
              const type = typeById(d.type);
              return (
                <div key={d.id} className="doc-list-item" style={{ borderTop: i ? '1px solid var(--line-soft)' : 'none' }} onClick={() => nav('detail', { id: d.id })} role="button" tabIndex={0}>
                  <span className="doc-list-icon"><Icon name={type?.icon || 'doc'} size={17} /></span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="doc-list-title">{d.name}</div>
                    <div className="row gap-8 text-xs muted mono">{d.documentNumber}<span style={{ color: 'var(--line)' }}>•</span>{fmtDate(d.updated)}</div>
                  </div>
                  <AreaTag areaId={d.area} />
                  <StateBadge state={d.state} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-sidebar">
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Más consultados</h3>
            {masConsultados.map((d, i) => (
              <div key={d.id} className="rank-item" style={{ borderTop: i ? '1px solid var(--line-soft)' : 'none' }} onClick={() => nav('detail', { id: d.id })} role="button" tabIndex={0}>
                <span className="rank-num">{i + 1}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="rank-title">{d.name}</div>
                </div>
                <span className="row gap-6 text-xs muted"><Icon name="eye" size={13} />{d.views}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '20px 22px' }}>
            <div className="row between mb-16">
              <h3 className="section-title" style={{ margin: 0 }}>Actividad reciente</h3>
              <Pager page={activityPage} pages={activityPages} total={activity.length} onPage={setActivityPage} />
            </div>
            <div className="timeline">
              {activity.length === 0 ? (
                <p className="text-xs muted" style={{ margin: 0 }}>Sin actividad registrada aún.</p>
              ) : visibleActivity.map((a, i) => (
                <div key={a.id ?? i} className="tl-item">
                  <span className={'tl-dot' + (i > 1 ? ' muted' : '')}></span>
                  <div style={{ fontSize: 13 }}>
                    <strong>{a.whoName}</strong> {a.action}
                    {a.doc && (
                      <span
                        className="link"
                        style={{ marginLeft: 4 }}
                        onClick={() => nav('detail', { id: a.doc })}
                      >
                        ver documento
                      </span>
                    )}
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 2 }}>{a.when}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

