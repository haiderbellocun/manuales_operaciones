import { useState, useMemo, useEffect, useRef } from 'react';
import { DATA } from '../data';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { Icon, StateBadge, AreaTag, DocCard, Avatar, FilterToggleButton } from '../components';
import { DocumentPreview } from '../components/DocumentPreview';

function FilterRail({ docs, filt, setFilt, className }) {
  const countBy = (key, val) => docs.filter(d => d[key] === val).length;
  const toggle = (key, val) => {
    const arr = filt[key].includes(val) ? filt[key].filter(x => x !== val) : [...filt[key], val];
    setFilt({ ...filt, [key]: arr });
  };
  const activeCount = filt.areas.length + filt.types.length + filt.states.length + (filt.fav ? 1 : 0);

  return (
    <aside className={'filter-rail ' + (className || '')}>
      <div className="row between mb-16">
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Filtros</h4>
        {activeCount > 0 ?
          <span className="link" style={{ fontSize: 12 }} onClick={() => setFilt({ ...filt, areas: [], types: [], states: [], fav: false })}>Limpiar</span> : null}
      </div>
      <div className="filter-group">
        <h4>Área</h4>
        {DATA.AREAS.map(a => (
          <label key={a.id} className="filter-opt">
            <input type="checkbox" checked={filt.areas.includes(a.id)} onChange={() => toggle('areas', a.id)} />
            <span className="area-dot" style={{ background: a.color }}></span>
            <span className="grow" style={{ fontSize: 12.5 }}>{a.code}</span>
            <span className="cnt">{countBy('area', a.id)}</span>
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h4>Tipo documental</h4>
        {DATA.TYPES.map(t => {
          const c = countBy('type', t.id);
          if (!c) return null;
          return (
            <label key={t.id} className="filter-opt">
              <input type="checkbox" checked={filt.types.includes(t.id)} onChange={() => toggle('types', t.id)} />
              <span className="grow">{t.name}</span>
              <span className="cnt">{c}</span>
            </label>
          );
        })}
      </div>
      <div className="filter-group">
        <h4>Estado</h4>
        {Object.keys(DATA.STATES).map(s => {
          const c = countBy('state', s);
          if (!c) return null;
          return (
            <label key={s} className="filter-opt">
              <input type="checkbox" checked={filt.states.includes(s)} onChange={() => toggle('states', s)} />
              <span className="grow">{DATA.STATES[s].label}</span>
              <span className="cnt">{c}</span>
            </label>
          );
        })}
      </div>
      <div className="filter-group">
        <label className="filter-opt">
          <input type="checkbox" checked={filt.fav} onChange={() => setFilt({ ...filt, fav: !filt.fav })} />
          <Icon name="star" size={15} /><span className="grow">Solo favoritos</span>
        </label>
      </div>
    </aside>
  );
}

function HybridRow({ doc, nav, toggleFav }) {
  const area = DATA.areaById(doc.area);
  const type = DATA.typeById(doc.type);
  return (
    <div className="card hybrid-row" onClick={() => nav('detail', { id: doc.id })} role="button" tabIndex={0}>
      <div className="hybrid-accent" style={{ background: area.color }}></div>
      <div className="hybrid-content">
        <span className="kpi-ico hybrid-icon"><Icon name={type.icon} size={21} /></span>
        <div className="hybrid-main">
          <div className="hybrid-title">{doc.name}</div>
          <div className="row gap-8 text-xs muted wrap hybrid-meta">
            <span className="mono">{doc.code} · v{doc.version}</span>
            <span style={{ color: 'var(--line)' }}>•</span>
            <span className="tag tag-type" style={{ padding: '1px 7px' }}>{type.name}</span>
            <span style={{ color: 'var(--line)' }}>•</span>
            <span>Resp. {DATA.personById(doc.owner).name}</span>
            <span style={{ color: 'var(--line)' }}>•</span>
            <span>Act. {DATA.fmtDate(doc.updated)}</span>
          </div>
        </div>
        <div className="row gap-12 hybrid-actions">
          <AreaTag areaId={doc.area} />
          <StateBadge state={doc.state} />
          <button className={'doc-fav' + (doc.fav ? ' on' : '')} onClick={(e) => { e.stopPropagation(); toggleFav(doc.id); }} aria-label="Favorito"><Icon name="star" size={18} /></button>
        </div>
      </div>
    </div>
  );
}

export function Library({ nav, docs, toggleFav, initParams }) {
  const savedPrefs = storage.getLibraryPrefs();
  const [filt, setFilt] = useState({
    q: '',
    areas: initParams?.area ? [initParams.area] : (savedPrefs.filt?.areas || []),
    types: initParams?.type ? [initParams.type] : (savedPrefs.filt?.types || []),
    states: savedPrefs.filt?.states || [],
    fav: initParams?.fav ?? savedPrefs.filt?.fav ?? false,
    sort: savedPrefs.sort || 'updated',
  });
  const [view, setView] = useState(savedPrefs.view || 'cards');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (initParams?.area) setFilt(f => ({ ...f, areas: [initParams.area] }));
    if (initParams?.fav) setFilt(f => ({ ...f, fav: true }));
  }, [initParams?.area, initParams?.fav]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storage.saveLibraryPrefs({ view, sort: filt.sort, filt: { areas: filt.areas, types: filt.types, states: filt.states, fav: filt.fav } });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [view, filt.sort, filt.areas, filt.types, filt.states, filt.fav]);

  const filtered = useMemo(() => {
    let r = docs.filter(d => {
      if (filt.areas.length && !filt.areas.includes(d.area)) return false;
      if (filt.types.length && !filt.types.includes(d.type)) return false;
      if (filt.states.length && !filt.states.includes(d.state)) return false;
      if (filt.fav && !d.fav) return false;
      if (filt.q) {
        const q = filt.q.toLowerCase();
        const hay = (d.name + ' ' + d.code + ' ' + (d.tags || []).join(' ') + ' ' + d.desc).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const s = filt.sort;
    r = [...r].sort((a, b) =>
      s === 'updated' ? b.updated.localeCompare(a.updated)
        : s === 'name' ? a.name.localeCompare(b.name)
          : s === 'views' ? b.views - a.views
            : a.code.localeCompare(b.code));
    return r;
  }, [docs, filt]);

  const areaName = initParams?.area ? DATA.areaById(initParams.area)?.name : null;
  const activeFilterCount = filt.areas.length + filt.types.length + filt.states.length + (filt.fav ? 1 : 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb">
          <a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span>
          <span>Biblioteca documental{areaName ? ' / ' + areaName : ''}</span>
        </div>
        <div className="row between wrap gap-12">
          <div>
            <h1 className="page-title">Biblioteca documental</h1>
            <p className="page-sub">{filtered.length} de {docs.length} documentos · repositorio operativo centralizado</p>
          </div>
          <button className="btn btn-primary" onClick={() => nav('upload')}><Icon name="upload" size={16} />Cargar documento</button>
        </div>
      </div>

      <div className="library-layout">
        {filtersOpen && <div className="filter-backdrop" onClick={() => setFiltersOpen(false)}></div>}
        <FilterRail docs={docs} filt={filt} setFilt={setFilt} className={filtersOpen ? 'open' : ''} />

        <div className="grow library-main">
          <div className="toolbar">
            <FilterToggleButton open={filtersOpen} count={activeFilterCount} onClick={() => setFiltersOpen(o => !o)} />
            <div className="field search-field">
              <Icon name="search" size={15} />
              <input placeholder="Buscar por nombre, código o palabra clave…" value={filt.q} onChange={e => setFilt({ ...filt, q: e.target.value })} />
            </div>
            <div className="field sort-field">
              <span className="text-xs muted">Ordenar</span>
              <select value={filt.sort} onChange={e => setFilt({ ...filt, sort: e.target.value })}>
                <option value="updated">Actualización</option>
                <option value="name">Nombre</option>
                <option value="code">Código</option>
                <option value="views">Más consultados</option>
              </select>
            </div>
            <div className="seg view-seg">
              <button type="button" className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')} title="Tarjetas"><Icon name="cards" size={15} /><span className="seg-label">Tarjetas</span></button>
              <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} title="Tabla"><Icon name="table" size={15} /><span className="seg-label">Tabla</span></button>
              <button type="button" className={view === 'hybrid' ? 'active' : ''} onClick={() => setView('hybrid')} title="Híbrida"><Icon name="hybrid" size={15} /><span className="seg-label">Híbrida</span></button>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="row gap-8 wrap mb-16">
              {filt.areas.map(a => <span key={a} className="chip active" onClick={() => setFilt({ ...filt, areas: filt.areas.filter(x => x !== a) })}>{DATA.areaById(a).code} <Icon name="x" size={12} /></span>)}
              {filt.types.map(t => <span key={t} className="chip active" onClick={() => setFilt({ ...filt, types: filt.types.filter(x => x !== t) })}>{DATA.typeById(t).name} <Icon name="x" size={12} /></span>)}
              {filt.states.map(s => <span key={s} className="chip active" onClick={() => setFilt({ ...filt, states: filt.states.filter(x => x !== s) })}>{DATA.STATES[s].label} <Icon name="x" size={12} /></span>)}
              {filt.fav && <span className="chip active" onClick={() => setFilt({ ...filt, fav: false })}>Favoritos <Icon name="x" size={12} /></span>}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="card empty-state">
              <Icon name="search" size={32} style={{ color: 'var(--ink-300)' }} />
              <p className="muted mt-16">No se encontraron documentos con esos filtros.</p>
            </div>
          ) : view === 'cards' ? (
            <div className="grid-cards">
              {filtered.map(d => <DocCard key={d.id} doc={d} onOpen={(id) => nav('detail', { id })} onFav={toggleFav} />)}
            </div>
          ) : view === 'table' ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Documento</th><th>Código</th><th>Tipo</th><th>Área</th><th>Versión</th><th>Responsable</th><th>Actualizado</th><th>Estado</th></tr></thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.id} onClick={() => nav('detail', { id: d.id })}>
                      <td className="col-name">{d.name}</td>
                      <td className="col-code">{d.code}</td>
                      <td>{DATA.typeById(d.type).name}</td>
                      <td><AreaTag areaId={d.area} /></td>
                      <td className="mono text-xs">v{d.version}</td>
                      <td className="text-sm">{DATA.personById(d.owner).name}</td>
                      <td className="text-sm muted">{DATA.fmtDate(d.updated)}</td>
                      <td><StateBadge state={d.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hybrid-list">
              {filtered.map(d => <HybridRow key={d.id} doc={d} nav={nav} toggleFav={toggleFav} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocDetail({ nav, docId, docs, toggleFav, requestUpdate }) {
  const doc = docs.find(d => d.id === docId) || DATA.docById(docId);
  const [tab, setTab] = useState('preview');
  const viewed = useRef(false);

  useEffect(() => {
    if (doc && !viewed.current) {
      viewed.current = true;
      api.incrementViews(doc.id);
    }
  }, [doc?.id]);

  if (!doc) {
    return (
      <div className="page">
        <div className="card empty-state">
          <Icon name="alert" size={32} style={{ color: 'var(--ink-300)' }} />
          <p className="muted mt-16">Documento no encontrado.</p>
          <button className="btn btn-primary mt-16" onClick={() => nav('library')}>Volver a biblioteca</button>
        </div>
      </div>
    );
  }

  const area = DATA.areaById(doc.area);
  const type = DATA.typeById(doc.type);
  const owner = DATA.personById(doc.owner);
  const related = (doc.related || []).map(id => DATA.docById(id)).filter(Boolean);

  const contextLink = doc.ans ? { label: 'Ver ficha ANS completa', view: 'ansDetail', params: { id: doc.ans } }
    : doc.cargo ? { label: 'Ver descriptor de cargo', view: 'cargoDetail', params: { id: doc.cargo } }
      : doc.app ? { label: 'Ver ficha de aplicación', view: 'appDetail', params: { id: doc.app } } : null;

  return (
    <div className="page fade-in">
      <div className="breadcrumb">
        <a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span>
        <a onClick={() => nav('library')}>Biblioteca</a><span className="sep">/</span>
        <a onClick={() => nav('library', { area: doc.area })}>{area.name}</a><span className="sep">/</span>
        <span style={{ color: 'var(--ink-700)' }}>{doc.code}</span>
      </div>

      <div className="card doc-header">
        <div className="doc-header-accent" style={{ background: area.color }}></div>
        <div className="doc-header-body">
          <div className="row between wrap gap-16">
            <div className="row gap-16 doc-header-info">
              <span className="kpi-ico doc-header-icon"><Icon name={type.icon} size={28} /></span>
              <div>
                <div className="row gap-8 wrap" style={{ marginBottom: 8 }}>
                  <span className="tag tag-type">{type.name}</span>
                  <AreaTag areaId={doc.area} />
                  <StateBadge state={doc.state} />
                </div>
                <h1 className="doc-header-title">{doc.name}</h1>
                <div className="row gap-12 mono text-sm muted doc-header-meta">
                  <span>{doc.code}</span><span style={{ color: 'var(--line)' }}>•</span>
                  <span>Versión {doc.version}</span><span style={{ color: 'var(--line)' }}>•</span>
                  <span className="row gap-6"><Icon name="eye" size={14} />{doc.views} consultas</span>
                </div>
              </div>
            </div>
            <div className="row gap-8 doc-header-actions">
              <button className="btn btn-ghost" onClick={() => toggleFav(doc.id)} style={doc.fav ? { color: '#c98a13', borderColor: '#ecd9a8' } : null}><Icon name="star" size={16} />{doc.fav ? 'Favorito' : 'Marcar'}</button>
              <button className="btn btn-ghost" onClick={() => requestUpdate(doc)}><Icon name="refresh" size={16} />Solicitar actualización</button>
              <button className="btn btn-primary"><Icon name="download" size={16} />Descargar</button>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="seg mb-16">
            <button type="button" className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}><Icon name="eye" size={15} />Previsualización</button>
            <button type="button" className={tab === 'desc' ? 'active' : ''} onClick={() => setTab('desc')}><Icon name="doc" size={15} />Descripción</button>
          </div>
          {tab === 'preview' ? (
            <div className="card" style={{ padding: 22 }}>
              <DocumentPreview docId={doc.id} doc={doc} height={420} onFullscreen />
            </div>
          ) : (
            <div className="card" style={{ padding: '22px 24px' }}>
              <h3 className="section-title">Descripción</h3>
              <p className="doc-desc">{doc.desc}</p>
              <div className="row gap-8 wrap mt-16">
                {(doc.tags || []).map(t => <span key={t} className="tag"><Icon name="tag" size={12} />{t}</span>)}
              </div>
            </div>
          )}

          {contextLink && (
            <div className="card context-link-card mt-24">
              <div className="row gap-12"><Icon name="link" size={18} style={{ color: 'var(--brand-700)' }} /><span className="context-link-text">Este documento tiene una ficha estructurada asociada</span></div>
              <button className="btn btn-primary btn-sm" onClick={() => nav(contextLink.view, contextLink.params)}>{contextLink.label} <Icon name="arrowRight" size={14} /></button>
            </div>
          )}

          {related.length > 0 && (
            <div className="mt-24">
              <h3 className="section-title">Documentos relacionados</h3>
              <div className="related-grid">
                {related.map(r => (
                  <div key={r.id} className="card related-card" onClick={() => nav('detail', { id: r.id })} role="button" tabIndex={0}>
                    <div className="row gap-10">
                      <span className="kpi-ico related-icon"><Icon name={DATA.typeById(r.type).icon} size={16} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="related-title">{r.name}</div>
                        <div className="mono text-xs muted">{r.code}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Ficha técnica</h3>
            <div className="spec-list">
              <div className="spec-row"><span className="k">Código</span><span className="v mono">{doc.code}</span></div>
              <div className="spec-row"><span className="k">Tipo documental</span><span className="v">{type.name}</span></div>
              <div className="spec-row"><span className="k">Área responsable</span><span className="v">{area.name}</span></div>
              <div className="spec-row"><span className="k">Versión vigente</span><span className="v">v{doc.version}</span></div>
              <div className="spec-row"><span className="k">Estado</span><span className="v"><StateBadge state={doc.state} /></span></div>
              <div className="spec-row"><span className="k">Creación</span><span className="v">{DATA.fmtDate(doc.created)}</span></div>
              <div className="spec-row"><span className="k">Última actualización</span><span className="v">{DATA.fmtDate(doc.updated)}</span></div>
              <div className="spec-row"><span className="k">Vigencia</span><span className="v" style={doc.state === 'vencido' ? { color: 'var(--st-vencido-fg)' } : null}>{DATA.fmtDate(doc.vigencia)}</span></div>
            </div>
            <div className="row gap-10 mt-16 owner-row">
              <Avatar name={owner.name} size={38} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{owner.name}</div>
                <div className="text-xs muted">{owner.role}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px 22px' }}>
            <div className="row between mb-16">
              <h3 className="section-title" style={{ margin: 0 }}>Historial de versiones</h3>
              <button className="link" type="button" onClick={() => nav('history', { id: doc.id })}>Comparar</button>
            </div>
            <div className="timeline">
              {doc.history.map((h, i) => (
                <div key={i} className="tl-item">
                  <span className={'tl-dot' + (i === 0 ? '' : ' muted')}></span>
                  <div className="row between">
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>v{h.v}{i === 0 && <span className="tag tag-type" style={{ marginLeft: 8, padding: '1px 7px' }}>vigente</span>}</span>
                    <span className="text-xs muted">{DATA.fmtDate(h.date)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 3 }}>{h.note}</div>
                  <div className="text-xs muted" style={{ marginTop: 2 }}>por {DATA.personById(h.by) ? DATA.personById(h.by).name : h.by}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
