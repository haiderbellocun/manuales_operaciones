import { useState, useMemo, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useDocs } from '../context/DocsContext';
import { useCatalogs } from '../context/CatalogContext';
import { STATES, fmtDate } from '../utils/display';
import { Icon, StateBadge, AreaTag, KpiCard, Avatar, FilterToggleButton, SelectField } from '../components';
import { FileDropzone } from '../components/DocumentPreview';
import { AreaCoordinationFields } from '../components/AreaCoordinationFields';
import { areaAssignmentValid, documentCodePrefix } from '../utils/areas';

export function SearchView({ nav, docs, initial }) {
  const { areas, types, typeById } = useCatalogs();
  const [q, setQ] = useState(initial || '');
  const [areaF, setAreaF] = useState([]);
  const [typeF, setTypeF] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSearchKey = (e) => {
    if (e.key === 'Enter' && q.trim()) storage.addSearchQuery(q);
  };

  const [recentSearches, setRecentSearches] = useState(() => storage.getSearchHistory());
  const populares = useMemo(() => [...docs].sort((a, b) => b.views - a.views).slice(0, 5), [docs]);
  const suggestions = useMemo(() => {
    const values = new Set();
    docs.forEach(d => {
      (d.tags || []).forEach(tag => values.add(tag));
      if (d.name) values.add(d.name.split(' ').slice(0, 3).join(' '));
    });
    return [...values].filter(Boolean).slice(0, 6);
  }, [docs]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return docs.filter(d => {
      if (areaF.length && !areaF.includes(d.area)) return false;
      if (typeF.length && !typeF.includes(d.type)) return false;
      const hay = (d.name + ' ' + d.documentNumber + ' ' + (d.tags || []).join(' ') + ' ' + d.desc).toLowerCase();
      return hay.includes(ql);
    });
  }, [q, docs, areaF, typeF]);

  const grouped = useMemo(() => {
    const g = {};
    results.forEach(d => { (g[d.type] = g[d.type] || []).push(d); });
    return g;
  }, [results]);

  const highlight = (text) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return <>{text.slice(0, idx)}<mark className="search-highlight">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
  };

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const activeFilterCount = areaF.length + typeF.length;

  return (
    <div className="page fade-in">
      <div className="row gap-10 mb-16" style={{ alignItems: 'center' }}>
        <Icon name="sparkles" size={22} style={{ color: 'var(--brand-600)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>Buscador inteligente</h1>
      </div>
      <div className="card search-bar">
        <Icon name="search" size={22} style={{ color: 'var(--brand-600)', flexShrink: 0 }} />
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={handleSearchKey} placeholder="Busca documentos, cargos, ANS, aplicaciones, procesos o palabras clave…" className="search-input" />
        {q && <button className="tbar-icon-btn" style={{ color: 'var(--ink-400)' }} onClick={() => setQ('')} aria-label="Limpiar"><Icon name="x" size={18} /></button>}
      </div>

      {!q.trim() ? (
        <div className="search-suggestions">
          <div className="card" style={{ padding: '22px 24px' }}>
            <h3 className="section-title">Sugerencias</h3>
            <div className="row gap-8 wrap">{suggestions.map(s => <span key={s} className="chip" onClick={() => setQ(s)}><Icon name="search" size={13} />{s}</span>)}</div>
          </div>
          <div className="card" style={{ padding: '22px 24px' }}>
            {recentSearches.length > 0 && (
              <>
                <div className="row between mb-12">
                  <h3 className="section-title" style={{ margin: 0 }}>Búsquedas recientes</h3>
                  <span className="link text-xs" onClick={() => { storage.clearSearchHistory(); setRecentSearches([]); }}>Limpiar</span>
                </div>
                <div className="row gap-8 wrap mb-20">
                  {recentSearches.map(s => <span key={s} className="chip" onClick={() => setQ(s)}>{s}</span>)}
                </div>
              </>
            )}
            <h3 className="section-title">Más consultados</h3>
            {populares.map((d, i) => (
              <div key={d.id} className="rank-item" style={{ borderTop: i ? '1px solid var(--line-soft)' : 'none', cursor: 'pointer' }} onClick={() => nav('detail', { id: d.id })} role="button" tabIndex={0}>
                <Icon name={typeById(d.type)?.icon || 'doc'} size={16} style={{ color: 'var(--brand-600)' }} />
                <span className="text-sm grow" style={{ fontWeight: 500 }}>{d.name}</span>
                <span className="text-xs muted row gap-6"><Icon name="eye" size={12} />{d.views}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="library-layout">
          {filtersOpen && <div className="filter-backdrop" onClick={() => setFiltersOpen(false)}></div>}
          <aside className={'filter-rail ' + (filtersOpen ? 'open' : '')}>
            <div className="filter-group">
              <h4>Refinar por área</h4>
              {areas.map(a => <label key={a.id} className="filter-opt"><input type="checkbox" checked={areaF.includes(a.id)} onChange={() => toggle(areaF, setAreaF, a.id)} /><span className="area-dot" style={{ background: a.color }}></span><span className="grow text-sm">{a.abbreviation}</span></label>)}
            </div>
            <div className="filter-group">
              <h4>Tipo documental</h4>
              {types.map(t => <label key={t.id} className="filter-opt"><input type="checkbox" checked={typeF.includes(t.id)} onChange={() => toggle(typeF, setTypeF, t.id)} /><span className="grow text-sm">{t.name}</span></label>)}
            </div>
          </aside>
          <div className="grow library-main">
            <div className="toolbar mb-16">
              <FilterToggleButton open={filtersOpen} count={activeFilterCount} onClick={() => setFiltersOpen(o => !o)} />
            </div>
            <p className="page-sub mb-16"><strong style={{ color: 'var(--ink-900)' }}>{results.length}</strong> resultado{results.length !== 1 ? 's' : ''} para “{q}”{(areaF.length || typeF.length) ? ' · filtrado' : ''}</p>
            {results.length === 0 ? (
              <div className="card empty-state"><Icon name="search" size={30} style={{ color: 'var(--ink-300)' }} /><p className="muted mt-16">Sin coincidencias. Prueba con otras palabras clave.</p></div>
            ) : Object.keys(grouped).map(typeId => {
              const t = typeById(typeId);
              return (
                <div key={typeId} className="search-group">
                  <div className="row gap-8 mb-12"><Icon name={t?.icon || 'doc'} size={16} style={{ color: 'var(--brand-600)' }} /><h3 className="search-group-title">{t?.name || 'Tipo no disponible'}</h3><span className="tag" style={{ padding: '1px 8px' }}>{grouped[typeId].length}</span></div>
                  <div className="search-results">
                    {grouped[typeId].map(d => (
                      <div key={d.id} className="card search-result" onClick={() => { storage.addSearchQuery(q); setRecentSearches(storage.getSearchHistory()); nav('detail', { id: d.id }); }} role="button" tabIndex={0}>
                        <span className="kpi-ico" style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--brand-50)', color: 'var(--brand-700)', flexShrink: 0 }}><Icon name={t?.icon || 'doc'} size={18} /></span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="row gap-8 wrap" style={{ marginBottom: 4 }}><span className="search-result-title">{highlight(d.name)}</span><AreaTag areaId={d.area} coordinationId={d.coordination} /><StateBadge state={d.state} /></div>
                          <p className="search-result-desc">{highlight(d.desc.slice(0, 130))}…</p>
                          <div className="row gap-8 wrap text-xs muted mono"><span>{d.documentNumber} · v{d.version}</span>{(d.tags || []).slice(0, 3).map(tg => <span key={tg} className="tag" style={{ padding: '0 7px' }}>{tg}</span>)}</div>
                        </div>
                        <Icon name="arrowRight" size={16} style={{ color: 'var(--ink-300)', flexShrink: 0, marginTop: 8 }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function UploadFlow({ nav, showToast, onUploaded }) {
  const { addDocument } = useDocs();
  const { user, hasPermission } = useAuth();
  const { coordinations } = useCatalogs();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [catalogs, setCatalogs] = useState({ areas: [], types: [], people: [], users: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogErrors, setCatalogErrors] = useState([]);
  const [f, setF] = useState({ type: '', area: '', coordination: '', name: '', desc: '', owner: '', vigencia: '', tags: '', version: '1.0', revisor: '', aprobador: '', versionNote: '' });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const setArea = (value) => setF(prev => ({ ...prev, area: value, coordination: '' }));
  const canAdmin = hasPermission('administrar');
  const visibleAreas = canAdmin || !user?.area
    ? catalogs.areas
    : catalogs.areas.filter(a => Number(a.id) === Number(user.area));
  const targetArea = f.area || user?.area;
  const visiblePeople = canAdmin || !targetArea
    ? catalogs.people
    : catalogs.people.filter(p => !p.area || Number(p.area) === Number(targetArea));
  const steps = ['Tipo y datos', 'Archivo y versión', 'Flujo de aprobación'];
  const typeCode = catalogs.types.find(t => String(t.id) === String(f.type));
  const areaCode = catalogs.areas.find(a => String(a.id) === String(f.area));
  const coordinationCode = coordinations.find(c => String(c.id) === String(f.coordination));
  const autoCode = (areaCode && typeCode)
    ? `${documentCodePrefix(areaCode, coordinationCode)}-${typeCode.abbreviation}-XXX`
    : '— — —';
  const areaReady = areaAssignmentValid(areaCode, f.coordination);
  const canNext = step === 0 ? (f.type && f.area && f.name && areaReady) : step === 1 ? !!file : true;

  useEffect(() => {
    setCatalogLoading(true);
    Promise.allSettled([api.getAreas(), api.getTypes(), api.getPeople(), api.getAssignableUsers()])
      .then(([areas, types, people, users]) => {
        setCatalogs({
          areas: areas.status === 'fulfilled' ? areas.value : [],
          types: types.status === 'fulfilled' ? types.value : [],
          people: people.status === 'fulfilled' ? people.value : [],
          users: users.status === 'fulfilled' ? users.value : [],
        });
        setCatalogErrors([
          areas.status === 'rejected' ? 'áreas' : null,
          types.status === 'rejected' ? 'tipos documentales' : null,
          people.status === 'rejected' ? 'responsables' : null,
          users.status === 'rejected' ? 'usuarios de flujo' : null,
        ].filter(Boolean));
      })
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    if (!canAdmin && user?.area && catalogs.areas.length > 0) {
      setF(prev => ({
        ...prev,
        area: String(user.area),
        coordination: user.coordination ? String(user.coordination) : '',
      }));
    }
  }, [canAdmin, user?.area, user?.coordination, catalogs.areas.length]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const newDoc = await addDocument({ ...f, file });
      showToast('Documento cargado y enviado al flujo de revisión', 'success');
      onUploaded?.();
      nav('detail', { id: newDoc.id });
    } catch (err) {
      showToast(err.message || 'Error al cargar el documento. Intenta de nuevo.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page fade-in upload-page">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Gestión</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Cargar documento</span></div>
      <h1 className="page-title mb-24">Cargar nuevo documento</h1>
      <div className="stepper">
        {steps.map((s, i) => (
          <div key={i} className="stepper-item">
            <div className="row gap-10 stepper-label">
              <span className={'stepper-dot' + (i <= step ? ' active' : '')}>{i < step ? <Icon name="check" size={16} /> : i + 1}</span>
              <span className={'text-sm stepper-text' + (i <= step ? ' active' : '')}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className={'stepper-line' + (i < step ? ' done' : '')}></div>}
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: '26px 28px' }}>
        {step === 0 && (
          <div>
            {catalogErrors.length > 0 && (
              <div className="login-error" style={{ marginBottom: 18 }}>
                <Icon name="alert" size={16} />
                No se pudieron cargar: {catalogErrors.join(', ')}. Reinicia el backend y recarga la página.
              </div>
            )}
            <div className="form-grid">
              <div className="form-row"><label>Tipo documental *</label><SelectField value={f.type} disabled={catalogLoading || catalogs.types.length === 0} onChange={value => set('type', value)} placeholder={catalogLoading ? 'Cargando...' : 'Seleccionar...'} options={catalogs.types.map(t => ({ value: t.id, label: t.name }))} /></div>
              <AreaCoordinationFields
                areas={visibleAreas}
                coordinations={coordinations}
                areaValue={f.area}
                coordinationValue={f.coordination}
                onAreaChange={setArea}
                onCoordinationChange={value => set('coordination', value)}
                areaDisabled={catalogLoading || visibleAreas.length === 0 || (!canAdmin && !!user?.area)}
                coordinationDisabled={catalogLoading || (!canAdmin && !!user?.coordination)}
                areaPlaceholder={catalogLoading ? 'Cargando...' : 'Seleccionar...'}
              />
            </div>
            <div className="form-row"><label>Nombre del documento *</label><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Procedimiento de matrícula de pregrado" /></div>
            <div className="form-row"><label>Descripción corta</label><textarea className="input" value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="Resumen del propósito y alcance del documento…"></textarea></div>
            <div className="form-grid">
              <div className="form-row"><label>Responsable</label><SelectField value={f.owner} disabled={catalogLoading || visiblePeople.length === 0} onChange={value => set('owner', value)} placeholder={catalogLoading ? 'Cargando...' : 'Seleccionar...'} options={visiblePeople.map(p => ({ value: p.id, label: p.name }))} /></div>
              <div className="form-row"><label>Vigencia hasta</label><input className="input" type="date" value={f.vigencia} onChange={e => set('vigencia', e.target.value)} /></div>
            </div>
            <div className="form-row"><label>Palabras clave <span className="hint">— separadas por coma</span></label><input className="input" value={f.tags} onChange={e => set('tags', e.target.value)} placeholder="matrícula, pregrado, procedimiento" /></div>
            <div className="number-preview"><Icon name="sparkles" size={16} style={{ color: 'var(--brand-700)' }} />Número documental asignado automáticamente: <strong className="mono" style={{ color: 'var(--brand-700)' }}>{autoCode}</strong></div>
          </div>
        )}
        {step === 1 && (
          <div>
            <div className="form-row"><label>Archivo del documento *</label>
              <FileDropzone file={file} onFile={setFile} />
            </div>
            <div className="form-grid">
              <div className="form-row"><label>Versión inicial</label><input className="input" value={f.version} onChange={e => set('version', e.target.value)} /></div>
              <div className="form-row"><label>Estado inicial</label><SelectField value="Borrador" onChange={() => {}} options={['Borrador', 'En revisión']} /></div>
            </div>
            <div className="form-row"><label>Descripción de la versión</label><textarea className="input" value={f.versionNote} onChange={e => set('versionNote', e.target.value)} placeholder="Ej. Versión inicial del documento."></textarea></div>
          </div>
        )}
        {step === 2 && (
          <div>
            {catalogErrors.includes('usuarios de flujo') && (
              <div className="login-error" style={{ marginBottom: 18 }}>
                <Icon name="alert" size={16} />
                No se pudieron cargar los usuarios del flujo. Reinicia el backend y recarga la página.
              </div>
            )}
            <p className="page-sub mb-24" style={{ marginTop: 0 }}>Define quién revisa y aprueba el documento antes de su publicación.</p>
            <div className="form-grid">
              <div className="form-row"><label>Revisor</label><SelectField value={f.revisor} disabled={catalogLoading || catalogs.users.length === 0} onChange={value => set('revisor', value)} placeholder={catalogLoading ? 'Cargando...' : 'Seleccionar...'} options={catalogs.users.filter(u => [4, 2, 3].includes(Number(u.role))).map(u => ({ value: u.id, label: u.name }))} /></div>
              <div className="form-row"><label>Aprobador</label><SelectField value={f.aprobador} disabled={catalogLoading || catalogs.users.length === 0} onChange={value => set('aprobador', value)} placeholder={catalogLoading ? 'Cargando...' : 'Seleccionar...'} options={catalogs.users.filter(u => [5, 2, 1].includes(Number(u.role))).map(u => ({ value: u.id, label: u.name }))} /></div>
            </div>
            <div className="card summary-card">
              <h4 style={{ margin: '0 0 14px', fontSize: 13 }}>Resumen del documento</h4>
              <div className="spec-list">
                <div className="spec-row"><span className="k">Nombre</span><span className="v">{f.name || '—'}</span></div>
                <div className="spec-row"><span className="k">Tipo</span><span className="v">{typeCode ? typeCode.name : '—'}</span></div>
                <div className="spec-row"><span className="k">Área</span><span className="v">{areaCode ? areaCode.name : '—'}{coordinationCode ? ` · ${coordinationCode.name}` : ''}</span></div>
                <div className="spec-row"><span className="k">Número documental</span><span className="v mono">{autoCode}</span></div>
                <div className="spec-row"><span className="k">Versión</span><span className="v">v{f.version}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="row between mt-24">
        <button className="btn btn-ghost" onClick={() => step === 0 ? nav('library') : setStep(step - 1)}><Icon name="chevLeft" size={16} />{step === 0 ? 'Cancelar' : 'Atrás'}</button>
        {step < 2 ? (
          <button className="btn btn-primary" disabled={!canNext} style={!canNext ? { opacity: .5, cursor: 'not-allowed' } : null} onClick={() => canNext && setStep(step + 1)}>Continuar<Icon name="arrowRight" size={16} /></button>
        ) : (
          <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}><Icon name="send" size={16} />{submitting ? 'Cargando…' : 'Cargar y enviar a revisión'}</button>
        )}
      </div>
    </div>
  );
}

export function WorkflowView({ nav, showToast }) {
  const { refresh } = useDocs();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [workflowPages, setWorkflowPages] = useState({});
  const workflowPageSize = 4;

  const loadWorkflow = () => {
    setLoading(true);
    return api.getWorkflow()
      .then(setItems)
      .catch(() => {
        setItems([]);
        showToast?.('No se pudo cargar el flujo de aprobación.', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadWorkflow(); }, []);

  const runTransition = async (item, action) => {
    setBusy(`${item.id}-${action}`);
    try {
      await api.transitionWorkflow(item.id, action);
      await loadWorkflow();
      await refresh();
      const messages = {
        submit: 'Borrador enviado a revisión.',
        approve: 'Documento enviado a aprobación.',
        publish: 'Documento publicado correctamente.',
        return: 'Documento devuelto para ajustes.',
      };
      showToast?.(messages[action] || 'Flujo actualizado correctamente.', action === 'return' ? 'warning' : 'success');
    } catch (err) {
      const type = err.status === 403 ? 'warning' : 'error';
      showToast?.(err.message || 'No se pudo actualizar el flujo.', type);
    } finally {
      setBusy(null);
    }
  };

  const flowSteps = [
    { k: 'creacion', label: 'Creación / Carga', icon: 'upload', desc: 'El editor crea o carga el documento' },
    { k: 'revision', label: 'Revisión', icon: 'eye', desc: 'El responsable revisa y valida' },
    { k: 'aprobacion', label: 'Aprobación', icon: 'check', desc: 'La autoridad aprueba para publicar' },
    { k: 'publicacion', label: 'Publicación', icon: 'send', desc: 'Se publica y notifica' },
  ];
  const stages = [
    { k: 'creacion', label: 'En creación', tone: 'borrador' },
    { k: 'revision', label: 'En revisión', tone: 'revision' },
    { k: 'aprobacion', label: 'En aprobación', tone: 'publicado' },
    { k: 'publicados', label: 'Publicados por mí', tone: 'aprobado' },
  ];
  const prioColor = { alta: 'var(--st-vencido-fg)', media: 'var(--st-revision-fg)', baja: 'var(--ink-400)' };
  const setStagePage = (stage, page) => setWorkflowPages(prev => ({ ...prev, [stage]: Math.max(0, page) }));

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Gestión</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Revisión y aprobación</span></div>
        <h1 className="page-title">Flujo de revisión y aprobación</h1>
        <p className="page-sub">{items.length} documentos en tu bandeja · ciclo de vida documental</p>
      </div>
      <div className="card" style={{ padding: '24px 28px', marginBottom: 26 }}>
        <h3 className="section-title">Ciclo documental</h3>
        <div className="flow-diagram">
          {flowSteps.map((s, i) => (
            <div key={s.k} className="flow-diagram-item">
              <div className="flow-diagram-step">
                <div className="flow-diagram-icon"><Icon name={s.icon} size={24} /></div>
                <div className="text-sm" style={{ fontWeight: 700 }}>{s.label}</div>
                <div className="text-xs muted flow-diagram-desc">{s.desc}</div>
              </div>
              {i < flowSteps.length - 1 && <Icon name="arrowRight" size={20} className="flow-diagram-arrow" />}
            </div>
          ))}
        </div>
      </div>
      <div className="kanban-grid">
        {stages.map(st => {
          const col = items.filter(it => (it.completedAt ? 'publicados' : it.stage) === st.k).filter(it => it.doc);
          const page = Math.min(workflowPages[st.k] || 0, Math.max(Math.ceil(col.length / workflowPageSize) - 1, 0));
          const totalPages = Math.max(Math.ceil(col.length / workflowPageSize), 1);
          const visibleItems = col.slice(page * workflowPageSize, page * workflowPageSize + workflowPageSize);
          return (
            <div key={st.k} className="kanban-stage">
              <div className="row between mb-12 kanban-header">
                <span className="row gap-8" style={{ fontWeight: 700, fontSize: 13.5 }}><span className={'badge badge-' + st.tone} style={{ padding: '2px 8px' }}><span className="b-dot"></span>{st.label}</span></span>
                <div className="row gap-8">
                  <span className="text-xs muted mono">{col.length}</span>
                  {col.length > workflowPageSize && (
                    <div className="kanban-pager">
                      <button type="button" className="tbar-icon-btn" disabled={page === 0} onClick={() => setStagePage(st.k, page - 1)}><Icon name="chevLeft" size={13} /></button>
                      <span className="text-xs mono">{page + 1}/{totalPages}</span>
                      <button type="button" className="tbar-icon-btn" disabled={page >= totalPages - 1} onClick={() => setStagePage(st.k, page + 1)}><Icon name="chevRight" size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
              <div className="kanban-col">
                {loading ? <div className="text-xs muted kanban-empty">Cargando flujo...</div> : col.length === 0 ? <div className="text-xs muted kanban-empty">Sin documentos</div> : visibleItems.map(it => (
                  <div key={it.id} className="card kanban-card" onClick={() => nav('detail', { id: it.doc.id })} role="button" tabIndex={0}>
                    <div className="kanban-card-main">
                      <div className="row between mb-12"><AreaTag areaId={it.doc.area} coordinationId={it.doc.coordination} /><span className="priority-label" style={{ color: prioColor[it.priority] }}>{it.priority}</span></div>
                      <div className="text-sm kanban-card-title">{it.doc.name}</div>
                      <div className="mono text-xs muted" style={{ marginTop: 5 }}>{it.doc.documentNumber} - v{it.doc.version}</div>
                    </div>
                    <div className="row gap-8 kanban-assignee">
                      <Avatar name={it.assignee} size={24} /><span className="text-xs muted grow assignee-name">{it.assignee}</span><span className="text-xs muted kanban-date">{fmtDate(it.since)}</span>
                    </div>
                    {(it.canSubmitToReview || it.canSendToApproval || it.canPublish || it.canReturn) && (
                      <div className="kanban-actions">
                        {it.canSubmitToReview && (
                          <button className="btn btn-primary btn-sm kanban-action-main" disabled={busy === `${it.id}-submit`} onClick={(e) => { e.stopPropagation(); runTransition(it, 'submit'); }} type="button"><Icon name="send" size={14} />Enviar a revision</button>
                        )}
                        {it.canSendToApproval && (
                          <button className="btn btn-primary btn-sm kanban-action-main" disabled={busy === `${it.id}-approve`} onClick={(e) => { e.stopPropagation(); runTransition(it, 'approve'); }} type="button"><Icon name="check" size={14} />Enviar a aprobacion</button>
                        )}
                        {it.canPublish && (
                          <button className="btn btn-primary btn-sm kanban-action-main" disabled={busy === `${it.id}-publish`} onClick={(e) => { e.stopPropagation(); runTransition(it, 'publish'); }} type="button"><Icon name="send" size={14} />Publicar</button>
                        )}
                        {it.canReturn && (
                          <button className="btn btn-danger btn-sm btn-icon kanban-return" disabled={busy === `${it.id}-return`} onClick={(e) => { e.stopPropagation(); runTransition(it, 'return'); }} type="button" title="Devolver para ajustes"><Icon name="x" size={14} /></button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UsersView({ nav }) {
  const { coordinations } = useCatalogs();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [roleModal, setRoleModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const permLabels = { crear: 'Crear', editar: 'Editar', aprobar: 'Aprobar', publicar: 'Publicar', archivar: 'Archivar', consultar: 'Consultar', descargar: 'Descargar', administrar: 'Administrar' };
  const permKeys = Object.keys(permLabels);
  const emptyForm = { name: '', email: '', role: '', area: '', coordination: '', status: 'Activo' };

  const loadUsers = () => {
    setLoading(true);
    return Promise.all([api.getUsers(), api.getRoles(), api.getAreas()])
      .then(([nextUsers, nextRoles, nextAreas]) => {
        setUsers(nextUsers);
        setRoles(nextRoles);
        setAreas(nextAreas);
      })
      .catch(() => {
        setUsers([]);
        setRoles([]);
        setAreas([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setError('');
    setModal({ mode: 'create', form: emptyForm });
  };

  const openEdit = (user) => {
    setError('');
    setModal({
      mode: 'edit',
      user,
      form: {
        name: user.name || '',
        email: user.email || '',
        role: user.role || '',
        area: user.area || '',
        coordination: user.coordination || '',
        status: user.status || 'Activo',
      },
    });
  };

  const setForm = (key, value) => setModal(prev => {
    if (key === 'area') {
      return { ...prev, form: { ...prev.form, area: value, coordination: '' } };
    }
    return { ...prev, form: { ...prev.form, [key]: value } };
  });

  const submitUser = async () => {
    if (!modal) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: modal.form.name,
        email: modal.form.email,
        role: modal.form.role,
        area: modal.form.area,
        coordination: modal.form.coordination,
        status: modal.form.status,
      };
      if (modal.mode === 'create') {
        await api.createUser(payload);
      } else {
        await api.updateUser(modal.user.id, payload);
      }
      setModal(null);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const openRoleEdit = (role) => {
    setError('');
    setRoleModal({
      role,
      form: {
        name: role.name || '',
        desc: role.desc || '',
        perms: { ...role.perms },
      },
    });
  };

  const setRoleForm = (key, value) => setRoleModal(prev => ({ ...prev, form: { ...prev.form, [key]: value } }));
  const togglePerm = (key) => setRoleModal(prev => ({
    ...prev,
    form: {
      ...prev.form,
      perms: { ...prev.form.perms, [key]: !prev.form.perms[key] },
    },
  }));

  const submitRole = async () => {
    if (!roleModal) return;
    setSaving(true);
    setError('');
    try {
      await api.updateRole(roleModal.role.id, roleModal.form);
      setRoleModal(null);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Gestión</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Usuarios y roles</span></div>
        <div className="row between wrap gap-12"><div><h1 className="page-title">Administración de usuarios y roles</h1><p className="page-sub">{loading ? 'Cargando usuarios y roles...' : `${users.length} usuarios · ${roles.length} roles definidos`}</p></div>{tab === 'users' && <button className="btn btn-primary" onClick={openCreate}><Icon name="plus" size={16} />Crear usuario</button>}</div>
      </div>
      <div className="seg mb-24">
        <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Icon name="users" size={15} />Usuarios</button>
        <button type="button" className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}><Icon name="shield" size={15} />Roles y permisos</button>
      </div>
      {tab === 'users' ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Acceso</th><th>Rol</th><th>Área</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {users.map(u => {
                const role = roles.find(r => Number(r.id) === Number(u.role));
                const ar = u.area ? areas.find(a => Number(a.id) === Number(u.area)) : null;
                const googleEnabled = String(u.email || '').toLowerCase().endsWith('@cun.edu.co');
                return (
                  <tr key={u.id}>
                    <td><div className="row gap-10"><Avatar name={u.name} size={32} /><span style={{ fontWeight: 600 }}>{u.name}</span></div></td>
                    <td className="text-sm muted">{u.email}</td>
                    <td><span className={'badge badge-' + (googleEnabled ? 'aprobado' : 'vencido')}><span className="b-dot"></span>{googleEnabled ? 'Google CUN' : 'Fuera de dominio'}</span></td>
                    <td><span className="tag tag-type">{role?.name || u.roleName || u.role}</span></td>
                    <td>{ar ? <AreaTag areaId={u.area} coordinationId={u.coordination} /> : <span className="tag tag-muted">Sin área</span>}</td>
                    <td className="text-sm muted">{fmtDate(u.last)}</td>
                    <td><span className={'badge badge-' + (u.status === 'Activo' ? 'aprobado' : 'archivado')}><span className="b-dot"></span>{u.status}</span></td>
                    <td><button className="tbar-icon-btn" style={{ color: 'var(--ink-500)', width: 32, height: 32 }} type="button" title="Editar usuario" onClick={() => openEdit(u)}><Icon name="edit" size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Rol</th><th>Descripción</th><th>Permisos activos</th><th>Usuarios</th><th></th></tr></thead>
            <tbody>
              {roles.map(r => {
                const activePerms = permKeys.filter(k => r.perms?.[k]);
                const userCount = users.filter(u => Number(u.role) === Number(r.id)).length;
                return (
                  <tr key={r.id}>
                    <td><div className="row gap-10"><span className="kpi-ico" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--brand-50)', color: 'var(--brand-700)' }}><Icon name="shield" size={16} /></span><span style={{ fontWeight: 700 }}>{r.name}</span></div></td>
                    <td className="text-sm muted" style={{ maxWidth: 360 }}>{r.desc}</td>
                    <td>
                      <div className="row gap-6 wrap">
                        {activePerms.slice(0, 5).map(k => <span key={k} className="tag" style={{ padding: '1px 7px', fontSize: 11 }}>{permLabels[k]}</span>)}
                        {activePerms.length > 5 && <span className="tag" style={{ padding: '1px 7px', fontSize: 11 }}>+{activePerms.length - 5}</span>}
                      </div>
                    </td>
                    <td className="text-sm mono muted">{userCount}</td>
                    <td><button className="tbar-icon-btn" style={{ color: 'var(--ink-500)', width: 32, height: 32 }} type="button" title="Editar rol" onClick={() => openRoleEdit(r)}><Icon name="edit" size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => !saving && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{modal.mode === 'create' ? 'Crear usuario' : 'Editar usuario'}</h3>
                <p className="muted text-sm">Configura acceso, rol y alcance operativo.</p>
              </div>
              <button className="tbar-icon-btn" type="button" onClick={() => setModal(null)} disabled={saving}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="login-error"><Icon name="alert" size={16} />{error}</div>}
              <div className="form-note"><Icon name="shield" size={15} />El acceso se valida con Google y solo se aceptan correos @cun.edu.co registrados en esta tabla.</div>
              <div className="form-grid">
                <div className="form-row"><label>Nombre *</label><input className="input" value={modal.form.name} onChange={e => setForm('name', e.target.value)} /></div>
                <div className="form-row"><label>Correo CUN *</label><input className="input" type="email" value={modal.form.email} onChange={e => setForm('email', e.target.value)} placeholder="usuario@cun.edu.co" /></div>
                <div className="form-row"><label>Rol *</label><SelectField value={modal.form.role} onChange={value => setForm('role', value)} placeholder="Seleccionar..." options={roles.map(r => ({ value: r.id, label: r.name }))} /></div>
                <AreaCoordinationFields
                  areas={areas}
                  coordinations={coordinations}
                  areaValue={modal.form.area || ''}
                  coordinationValue={modal.form.coordination || ''}
                  onAreaChange={value => setForm('area', value)}
                  onCoordinationChange={value => setForm('coordination', value)}
                  areaLabel="Área"
                  allowEmptyArea
                  areaPlaceholder="Sin área"
                />
                <div className="form-row"><label>Estado</label><SelectField value={modal.form.status} onChange={value => setForm('status', value)} options={['Activo', 'Inactivo']} /></div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" type="button" onClick={() => setModal(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={submitUser} disabled={saving}>{saving ? 'Guardando...' : 'Guardar usuario'}<Icon name="check" size={15} /></button>
            </div>
          </div>
        </div>
      )}
      {roleModal && (
        <div className="modal-backdrop" onClick={() => !saving && setRoleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Editar rol</h3>
                <p className="muted text-sm">Activa o desactiva permisos para todos los usuarios con este rol.</p>
              </div>
              <button className="tbar-icon-btn" type="button" onClick={() => setRoleModal(null)} disabled={saving}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="login-error"><Icon name="alert" size={16} />{error}</div>}
              <div className="form-row">
                <label>Nombre *</label>
                <input className="input" value={roleModal.form.name} onChange={e => setRoleForm('name', e.target.value)} />
              </div>
              <div className="form-row">
                <label>Descripción</label>
                <textarea className="input" value={roleModal.form.desc} onChange={e => setRoleForm('desc', e.target.value)} />
              </div>
              <div className="permissions-grid">
                {permKeys.map(k => (
                  <label key={k} className="permission-toggle">
                    <input type="checkbox" checked={!!roleModal.form.perms[k]} onChange={() => togglePerm(k)} disabled={Number(roleModal.role.id) === 1 && ['administrar', 'consultar'].includes(k)} />
                    <span><strong>{permLabels[k]}</strong><small>{k}</small></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" type="button" onClick={() => setRoleModal(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={submitRole} disabled={saving}>{saving ? 'Guardando...' : 'Guardar rol'}<Icon name="check" size={15} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, color }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i}>
          <div className="row between" style={{ marginBottom: 5 }}><span className="text-sm" style={{ fontWeight: 500 }}>{d.label}</span><span className="text-sm mono" style={{ fontWeight: 600, color: 'var(--ink-600)' }}>{d.value}</span></div>
          <div className="bar"><span style={{ width: (d.value / max * 100) + '%', background: d.color || color || 'var(--brand-600)' }}></span></div>
        </div>
      ))}
    </div>
  );
}

export function ReportsView({ nav, docs }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.getReportSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const byArea = summary?.byArea || [];
  const byState = (summary?.byState || []).map(s => {
    const state = STATES[s.label];
    return { ...s, label: state?.label || s.label, color: state ? `var(--st-${state.cls}-fg)` : undefined };
  });
  const byType = summary?.byType || [];
  const topViews = summary?.topViews || [];
  const avgVers = summary?.averageVersions ?? 0;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Reportes e indicadores</span></div>
        <div className="row between wrap gap-12"><div><h1 className="page-title">Reportes e indicadores de gestión</h1><p className="page-sub">Estado del repositorio documental según tu alcance actual</p></div><button className="btn btn-ghost"><Icon name="download" size={16} />Exportar informe</button></div>
      </div>
      <div className="grid-kpi mb-24">
        <KpiCard icon="check" value={docs.filter(d => ['publicado', 'aprobado'].includes(d.state)).length} label="Documentos vigentes" tone="brand" />
        <KpiCard icon="alert" value={docs.filter(d => d.state === 'vencido').length} label="Documentos vencidos" tone="red" />
        <KpiCard icon="clock" value={docs.filter(d => d.state === 'revision').length} label="Pendientes de revisión" tone="amber" />
        <KpiCard icon="doc" value={docs.length} label="Documentos visibles" tone="blue" />
        <KpiCard icon="history" value={avgVers} label="Versiones por documento" tone="gray" />
      </div>
      <div className="reports-grid">
        <div className="card" style={{ padding: '22px 24px' }}><h3 className="section-title">Documentos por área</h3><BarChart data={byArea} /></div>
        <div className="card" style={{ padding: '22px 24px' }}><h3 className="section-title">Documentos por estado</h3><BarChart data={byState} /></div>
        <div className="card" style={{ padding: '22px 24px' }}><h3 className="section-title">Documentos por tipo</h3><BarChart data={byType} color="var(--brand-500)" /></div>
        <div className="card" style={{ padding: '22px 24px' }}>
          <h3 className="section-title">Documentos más consultados</h3>
          {topViews.map((d, i) => (
            <div key={d.id} className="rank-item" style={{ borderTop: i ? '1px solid var(--line-soft)' : 'none', cursor: 'pointer' }} onClick={() => nav('detail', { id: d.id })} role="button" tabIndex={0}>
              <span className="mono rank-num">{i + 1}</span>
              <span className="text-sm grow rank-title">{d.name}</span>
              <span className="text-xs muted row gap-6"><Icon name="eye" size={13} />{d.views}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HelpView({ nav }) {
  const faqs = [
    { q: '¿Cómo cargo un nuevo documento?', a: 'Ve a Gestión → Cargar documento. Completa el tipo, área y datos básicos, adjunta el archivo y define el flujo de revisión.' },
    { q: '¿Qué significan los estados de un documento?', a: 'Borrador (en construcción), En revisión, Aprobado, Publicado (vigente y visible), Vencido (superó su vigencia) y Archivado (versión obsoleta).' },
    { q: '¿Cómo solicito la actualización de un documento?', a: 'En la ficha del documento usa el botón “Solicitar actualización”. Se notificará al responsable del área.' },
    { q: '¿Quién puede aprobar documentos?', a: 'Los roles Líder de área, Aprobador y Administrador general pueden aprobar y publicar documentos.' },
    { q: '¿Cómo busco un documento rápidamente?', a: 'Usa el buscador inteligente (⌘K / Ctrl+K) y busca por nombre, código, cargo, ANS, aplicación o palabra clave.' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <div className="page fade-in help-page">
      <div className="page-head"><div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Ayuda</span></div><h1 className="page-title">Centro de ayuda</h1><p className="page-sub">Preguntas frecuentes y guías de uso de la plataforma</p></div>
      <div className="help-cards">
        {[{ i: 'upload', t: 'Cargar documentos', d: 'Guía de carga y versiones', view: 'upload' }, { i: 'flow', t: 'Flujo de aprobación', d: 'Revisión y publicación', view: 'workflow' }, { i: 'shield', t: 'Roles y permisos', d: 'Qué puede hacer cada rol', view: 'users' }].map((c, i) => (
          <div key={i} className="card help-card" onClick={() => nav(c.view)} role="button" tabIndex={0}>
            <span className="kpi-ico" style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--brand-50)', color: 'var(--brand-700)' }}><Icon name={c.i} size={20} /></span>
            <div className="help-card-title">{c.t}</div>
            <div className="text-sm muted">{c.d}</div>
          </div>
        ))}
      </div>
      <h3 className="section-title">Preguntas frecuentes</h3>
      <div className="card faq-card">
        {faqs.map((f, i) => (
          <div key={i} className="faq-item">
            <button type="button" className="row between faq-btn" onClick={() => setOpen(open === i ? -1 : i)}>
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>{f.q}</span>
              <Icon name="chevDown" size={18} style={{ color: 'var(--ink-400)', transform: open === i ? 'rotate(180deg)' : '', transition: 'transform .15s', flexShrink: 0 }} />
            </button>
            {open === i && <p className="faq-answer-lg">{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
