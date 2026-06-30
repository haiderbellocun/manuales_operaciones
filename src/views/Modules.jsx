import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCatalogs } from '../context/CatalogContext';
import { STATES, fmtDate } from '../utils/display';
import { Icon, StateBadge, AreaTag, KpiCard } from '../components';

function LoadingState({ label = 'Cargando información...' }) {
  return (
    <div className="page">
      <div className="card empty-state">
        <Icon name="clock" size={32} style={{ color: 'var(--brand-500)' }} />
        <p className="muted mt-16">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="card empty-state">
      <Icon name="search" size={32} style={{ color: 'var(--ink-300)' }} />
      <p className="muted mt-16">{label}</p>
    </div>
  );
}

function useApiResource(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader()
      .then(result => alive && setData(result))
      .catch((err) => {
        if (!alive) return;
        setData(null);
        setError(err);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, deps);

  return { data, loading, error };
}

function ErrorState({ error }) {
  return (
    <div className="card empty-state">
      <Icon name="alert" size={32} style={{ color: 'var(--st-vencido-fg)' }} />
      <p className="muted mt-16">{error?.message || 'No se pudo cargar la informacion del modulo.'}</p>
      <p className="text-xs muted mt-8">Verifica que el backend este reiniciado y que la ruta API este disponible.</p>
    </div>
  );
}

function ModuleHeader({ nav, title, subtitle, actionLabel }) {
  const { hasPermission } = useAuth();
  return (
    <div className="page-head">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Módulos</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>{title}</span></div>
      <div className="row between wrap gap-12">
        <div><h1 className="page-title">{title}</h1><p className="page-sub">{subtitle}</p></div>
        {hasPermission('crear') && <button className="btn btn-primary" onClick={() => nav('upload')}><Icon name="plus" size={16} />{actionLabel}</button>}
      </div>
    </div>
  );
}

function DocumentLinkedCard({ item, icon, onOpen, children }) {
  const { areaById } = useCatalogs();
  const area = areaById(item.area);
  return (
    <div className="card module-card" onClick={onOpen} role="button" tabIndex={0}>
      <div className="module-card-head">
        <div className="row between mb-12">
          <span className="kpi-ico" style={{ width: 40, height: 40, borderRadius: 11, background: area?.color || 'var(--brand-600)', color: '#fff' }}><Icon name={icon} size={20} /></span>
          <StateBadge state={item.state} />
        </div>
        <div className="module-card-title">{item.name}</div>
        <div className="mono text-xs muted" style={{ marginTop: 5 }}>{item.documentNumber} · v{item.version}</div>
      </div>
      {children}
    </div>
  );
}

export function AnsModule({ nav }) {
  const { data: list, loading, error } = useApiResource(() => api.getAnsModules(), []);
  const { areaById } = useCatalogs();
  if (loading) return <LoadingState />;

  return (
    <div className="page fade-in">
      <ModuleHeader nav={nav} title="Acuerdos de Nivel de Servicio" subtitle={`${list?.length || 0} ANS documentados desde la base de datos`} actionLabel="Nuevo ANS" />
      {error ? <ErrorState error={error} /> : !list?.length ? <EmptyState label="No hay ANS visibles para tu perfil." /> : (
        <div className="module-grid">
          {list.map(item => (
            <DocumentLinkedCard key={item.id} item={item} icon="handshake" onOpen={() => nav('ansDetail', { id: item.id })}>
              <div className="module-card-meta">
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Área</div><div className="text-sm" style={{ fontWeight: 600, marginTop: 3 }}>{areaById(item.area)?.abbreviation || 'N/D'}</div></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Actualizado</div><div className="text-sm" style={{ fontWeight: 600, marginTop: 3 }}>{fmtDate(item.updated)}</div></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Consultas</div><div className="row gap-6 text-sm" style={{ fontWeight: 600, marginTop: 3, color: 'var(--brand-700)' }}><Icon name="eye" size={14} />{item.views}</div></div>
              </div>
            </DocumentLinkedCard>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnsDetail({ nav, ansId }) {
  const { data: item, loading, error } = useApiResource(() => api.getAnsModule(ansId), [ansId]);
  const { areaById } = useCatalogs();
  if (loading) return <LoadingState />;
  if (error) return <div className="page"><ErrorState error={error} /></div>;
  if (!item) return <div className="page"><EmptyState label="ANS no encontrado." /></div>;
  const area = areaById(item.area);

  return (
    <div className="page fade-in">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><a onClick={() => nav('ans')}>ANS</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>{item.documentNumber}</span></div>
      <div className="card doc-header">
        <div className="doc-header-accent" style={{ background: area?.color }}></div>
        <div className="doc-header-body">
          <div className="row between wrap gap-16">
            <div className="row gap-16 doc-header-info">
              <span className="kpi-ico doc-header-icon"><Icon name="handshake" size={28} /></span>
              <div>
                <div className="row gap-8 mb-12"><span className="tag tag-type">ANS</span><AreaTag areaId={item.area} coordinationId={item.coordination} /><StateBadge state={item.state} /></div>
                <h1 className="doc-header-title">{item.name}</h1>
                <div className="mono text-sm muted" style={{ marginTop: 8 }}>{item.documentNumber} · Versión {item.version} · Vigencia {fmtDate(item.vigencia)}</div>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => nav('detail', { id: item.docId })}><Icon name="doc" size={16} />Ver documento</button>
          </div>
        </div>
      </div>
      <div className="grid-kpi mb-24">
        <KpiCard icon="building" value={area?.abbreviation || '—'} label="Área responsable" tone="brand" />
        <KpiCard icon="eye" value={item.views} label="Consultas" tone="blue" />
        <KpiCard icon="history" value={fmtDate(item.updated)} label="Última actualización" tone="gray" />
      </div>
      <div className="card" style={{ padding: '24px 28px' }}>
        <h3 className="section-title">Descripción documental</h3>
        <p className="field-text">{item.description || 'Este ANS aún no tiene descripción registrada.'}</p>
      </div>
    </div>
  );
}

export function CargosModule({ nav }) {
  const [area, setArea] = useState('all');
  const { data: allItems, loading, error } = useApiResource(() => api.getCargoModules(), []);
  const { areas, areaById } = useCatalogs();
  if (loading) return <LoadingState />;
  const items = allItems || [];
  const visibleAreaIds = new Set(items.map(item => item.area));
  const list = items.filter(item => area === 'all' || Number(item.area) === Number(area));

  return (
    <div className="page fade-in">
      <ModuleHeader nav={nav} title="Manuales de funciones y descriptores de cargo" subtitle={`${list.length} cargos visibles desde la base de datos`} actionLabel="Nuevo cargo" />
      <div className="row gap-8 wrap mb-24">
        <span className={'chip' + (area === 'all' ? ' active' : '')} onClick={() => setArea('all')}>Todas las áreas</span>
        {areas.filter(a => visibleAreaIds.has(a.id)).map(a => <span key={a.id} className={'chip' + (area === a.id ? ' active' : '')} onClick={() => setArea(a.id)}><span className="area-dot" style={{ background: area === a.id ? '#fff' : a.color }}></span>{a.abbreviation}</span>)}
      </div>
      {error ? <ErrorState error={error} /> : !list.length ? <EmptyState label="No hay cargos visibles para tu perfil." /> : (
        <div className="cargo-grid">
          {list.map(item => {
            const ar = areaById(item.area);
            return (
              <div key={item.id} className="card cargo-card" onClick={() => nav('cargoDetail', { id: item.id })} role="button" tabIndex={0}>
                <div className="row between mb-12"><span className="kpi-ico" style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--brand-50)', color: 'var(--brand-700)' }}><Icon name="idcard" size={21} /></span><span className="tag" style={{ background: ar?.color, color: '#fff', borderColor: 'transparent' }}>{ar?.abbreviation}</span></div>
                <div className="cargo-name">{item.name}</div>
                <div className="text-sm muted" style={{ marginTop: 4 }}>{item.documentNumber} · v{item.version}</div>
                <p className="cargo-preview">{item.description}</p>
                <div className="row between cargo-foot"><span className="text-xs muted">{fmtDate(item.updated)}</span><span className="link">Ver ficha →</span></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CargoDetail({ nav, cargoId }) {
  const { data: item, loading, error } = useApiResource(() => api.getCargoModule(cargoId), [cargoId]);
  const { areaById, typeById } = useCatalogs();
  if (loading) return <LoadingState />;
  if (error) return <div className="page"><ErrorState error={error} /></div>;
  if (!item) return <div className="page"><EmptyState label="Cargo no encontrado." /></div>;
  const ar = areaById(item.area);

  return (
    <div className="page fade-in">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><a onClick={() => nav('cargos')}>Funciones y cargos</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>{item.name}</span></div>
      <div className="card doc-header">
        <div className="doc-header-accent" style={{ background: ar?.color }}></div>
        <div className="doc-header-body">
          <div className="row between wrap gap-16">
            <div className="row gap-16 doc-header-info">
              <span className="kpi-ico doc-header-icon"><Icon name="idcard" size={28} /></span>
              <div>
                <div className="row gap-8 mb-12"><span className="tag tag-type">{typeById(item.type)?.name || 'Tipo no disponible'}</span><AreaTag areaId={item.area} coordinationId={item.coordination} /><StateBadge state={item.state} /></div>
                <h1 className="doc-header-title">{item.name}</h1>
                <div className="text-sm muted" style={{ marginTop: 8 }}>{item.documentNumber} · v{item.version}</div>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => nav('detail', { id: item.docId })}><Icon name="doc" size={16} />Ver documento</button>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: '24px 28px' }}>
        <h3 className="section-title">Descripción documental</h3>
        <p className="field-text field-text-lg">{item.description || 'Este cargo aún no tiene descripción registrada.'}</p>
      </div>
    </div>
  );
}

export function AppsModule({ nav }) {
  const { data: list, loading, error } = useApiResource(() => api.getAppModules(), []);
  if (loading) return <LoadingState />;

  return (
    <div className="page fade-in">
      <ModuleHeader nav={nav} title="Manuales de aplicaciones" subtitle={`${list?.length || 0} aplicaciones documentadas desde la base de datos`} actionLabel="Nueva aplicación" />
      {error ? <ErrorState error={error} /> : !list?.length ? <EmptyState label="No hay aplicaciones visibles para tu perfil." /> : (
        <div className="apps-grid">
          {list.map(item => (
            <div key={item.id} className="card app-card" onClick={() => nav('appDetail', { id: item.id })} role="button" tabIndex={0}>
              <div className="app-card-body">
                <div className="row between mb-12"><span className="kpi-ico app-icon"><Icon name="app" size={22} /></span><StateBadge state={item.state} /></div>
                <div className="app-name">{item.name}</div>
                <p className="app-desc">{item.description}</p>
              </div>
              <div className="app-card-foot">
                <div className="row gap-12 text-xs muted"><span className="mono">v{item.version}</span><span className="row gap-6"><Icon name="eye" size={13} />{item.views}</span></div>
                <AreaTag areaId={item.area} coordinationId={item.coordination} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppDetail({ nav, appId }) {
  const { data: item, loading, error } = useApiResource(() => api.getAppModule(appId), [appId]);
  const { areaById } = useCatalogs();
  if (loading) return <LoadingState />;
  if (error) return <div className="page"><ErrorState error={error} /></div>;
  if (!item) return <div className="page"><EmptyState label="Aplicación no encontrada." /></div>;

  return (
    <div className="page fade-in">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><a onClick={() => nav('apps')}>Aplicaciones</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>{item.name}</span></div>
      <div className="card" style={{ padding: '24px 28px', marginBottom: 24 }}>
        <div className="row between wrap gap-16">
          <div className="row gap-16 doc-header-info">
            <span className="kpi-ico app-icon-lg"><Icon name="app" size={28} /></span>
            <div>
              <div className="row gap-8 mb-12"><AreaTag areaId={item.area} coordinationId={item.coordination} /><StateBadge state={item.state} /><span className="tag mono">v{item.version}</span></div>
              <h1 className="doc-header-title">{item.name}</h1>
              <p className="app-detail-desc">{item.description}</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => nav('detail', { id: item.docId })}><Icon name="doc" size={16} />Ver manual</button>
        </div>
      </div>
      <div className="card" style={{ padding: '22px 24px' }}>
        <h3 className="section-title">Información registrada</h3>
        <div className="spec-list">
          <div className="spec-row"><span className="k">Documento</span><span className="v mono">{item.documentNumber}</span></div>
          <div className="spec-row"><span className="k">Área</span><span className="v">{areaById(item.area)?.name || 'No disponible'}</span></div>
          <div className="spec-row"><span className="k">Estado documental</span><span className="v"><StateBadge state={item.state} /></span></div>
          <div className="spec-row"><span className="k">Actualización</span><span className="v">{fmtDate(item.updated)}</span></div>
        </div>
      </div>
    </div>
  );
}

