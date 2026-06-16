import { useState, useMemo, useEffect, useRef } from 'react';
import { DATA } from '../data';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { saveFile } from '../services/fileStore';
import { useAuth } from '../context/AuthContext';
import { useDocs } from '../context/DocsContext';
import { Icon, StateBadge, AreaTag, KpiCard, Avatar, FilterToggleButton } from '../components';
import { FileDropzone } from '../components/DocumentPreview';

export function SearchView({ nav, docs, initial }) {
  const [q, setQ] = useState(initial || '');
  const [areaF, setAreaF] = useState([]);
  const [typeF, setTypeF] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSearchKey = (e) => {
    if (e.key === 'Enter' && q.trim()) storage.addSearchQuery(q);
  };

  const sugerencias = ['Homologación', 'ANS prácticas', 'Coordinador', 'Pruebas Saber', 'Procedimiento matrícula', 'SIHO'];
  const [recentSearches, setRecentSearches] = useState(() => storage.getSearchHistory());
  const populares = useMemo(() => [...docs].sort((a, b) => b.views - a.views).slice(0, 5), [docs]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return docs.filter(d => {
      if (areaF.length && !areaF.includes(d.area)) return false;
      if (typeF.length && !typeF.includes(d.type)) return false;
      const hay = (d.name + ' ' + d.code + ' ' + (d.tags || []).join(' ') + ' ' + d.desc).toLowerCase();
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
            <div className="row gap-8 wrap">{sugerencias.map(s => <span key={s} className="chip" onClick={() => setQ(s)}><Icon name="search" size={13} />{s}</span>)}</div>
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
                <Icon name={DATA.typeById(d.type).icon} size={16} style={{ color: 'var(--brand-600)' }} />
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
              {DATA.AREAS.map(a => <label key={a.id} className="filter-opt"><input type="checkbox" checked={areaF.includes(a.id)} onChange={() => toggle(areaF, setAreaF, a.id)} /><span className="area-dot" style={{ background: a.color }}></span><span className="grow text-sm">{a.code}</span></label>)}
            </div>
            <div className="filter-group">
              <h4>Tipo documental</h4>
              {DATA.TYPES.map(t => <label key={t.id} className="filter-opt"><input type="checkbox" checked={typeF.includes(t.id)} onChange={() => toggle(typeF, setTypeF, t.id)} /><span className="grow text-sm">{t.name}</span></label>)}
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
              const t = DATA.typeById(typeId);
              return (
                <div key={typeId} className="search-group">
                  <div className="row gap-8 mb-12"><Icon name={t.icon} size={16} style={{ color: 'var(--brand-600)' }} /><h3 className="search-group-title">{t.name}</h3><span className="tag" style={{ padding: '1px 8px' }}>{grouped[typeId].length}</span></div>
                  <div className="search-results">
                    {grouped[typeId].map(d => (
                      <div key={d.id} className="card search-result" onClick={() => { storage.addSearchQuery(q); setRecentSearches(storage.getSearchHistory()); nav('detail', { id: d.id }); }} role="button" tabIndex={0}>
                        <span className="kpi-ico" style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--brand-50)', color: 'var(--brand-700)', flexShrink: 0 }}><Icon name={t.icon} size={18} /></span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="row gap-8 wrap" style={{ marginBottom: 4 }}><span className="search-result-title">{highlight(d.name)}</span><AreaTag areaId={d.area} /><StateBadge state={d.state} /></div>
                          <p className="search-result-desc">{highlight(d.desc.slice(0, 130))}…</p>
                          <div className="row gap-8 wrap text-xs muted mono"><span>{d.code} · v{d.version}</span>{(d.tags || []).slice(0, 3).map(tg => <span key={tg} className="tag" style={{ padding: '0 7px' }}>{tg}</span>)}</div>
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
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ type: '', area: '', name: '', desc: '', owner: '', vigencia: '', tags: '', version: '1.0', revisor: '', aprobador: '', versionNote: '' });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const steps = ['Tipo y datos', 'Archivo y versión', 'Flujo de aprobación'];
  const typeCode = DATA.typeById(f.type);
  const areaCode = DATA.areaById(f.area);
  const autoCode = (areaCode && typeCode) ? `${areaCode.code}-${typeCode.short}-XXX` : '— — —';
  const canNext = step === 0 ? (f.type && f.area && f.name) : step === 1 ? !!file : true;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const newDoc = await addDocument({ ...f, file });
      if (file && api.config.useMock) await saveFile(newDoc.id, file);
      showToast('Documento cargado y enviado al flujo de revisión');
      onUploaded?.();
      nav('detail', { id: newDoc.id });
    } catch {
      showToast('Error al cargar el documento. Intenta de nuevo.');
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
            <div className="form-grid">
              <div className="form-row"><label>Tipo documental *</label><select className="input" value={f.type} onChange={e => set('type', e.target.value)}><option value="">Seleccionar…</option>{DATA.TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="form-row"><label>Área responsable *</label><select className="input" value={f.area} onChange={e => set('area', e.target.value)}><option value="">Seleccionar…</option>{DATA.AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            </div>
            <div className="form-row"><label>Nombre del documento *</label><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Procedimiento de matrícula de pregrado" /></div>
            <div className="form-row"><label>Descripción corta</label><textarea className="input" value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="Resumen del propósito y alcance del documento…"></textarea></div>
            <div className="form-grid">
              <div className="form-row"><label>Responsable</label><select className="input" value={f.owner} onChange={e => set('owner', e.target.value)}><option value="">Seleccionar…</option>{Object.keys(DATA.PEOPLE).map(k => <option key={k} value={k}>{DATA.PEOPLE[k].name}</option>)}</select></div>
              <div className="form-row"><label>Vigencia hasta</label><input className="input" type="date" value={f.vigencia} onChange={e => set('vigencia', e.target.value)} /></div>
            </div>
            <div className="form-row"><label>Palabras clave <span className="hint">— separadas por coma</span></label><input className="input" value={f.tags} onChange={e => set('tags', e.target.value)} placeholder="matrícula, pregrado, procedimiento" /></div>
            <div className="code-preview"><Icon name="sparkles" size={16} style={{ color: 'var(--brand-700)' }} />Código asignado automáticamente: <strong className="mono" style={{ color: 'var(--brand-700)' }}>{autoCode}</strong></div>
          </div>
        )}
        {step === 1 && (
          <div>
            <div className="form-row"><label>Archivo del documento *</label>
              <FileDropzone file={file} onFile={setFile} />
            </div>
            <div className="form-grid">
              <div className="form-row"><label>Versión inicial</label><input className="input" value={f.version} onChange={e => set('version', e.target.value)} /></div>
              <div className="form-row"><label>Estado inicial</label><select className="input"><option>Borrador</option><option>En revisión</option></select></div>
            </div>
            <div className="form-row"><label>Descripción de la versión</label><textarea className="input" value={f.versionNote} onChange={e => set('versionNote', e.target.value)} placeholder="Ej. Versión inicial del documento."></textarea></div>
          </div>
        )}
        {step === 2 && (
          <div>
            <p className="page-sub mb-24" style={{ marginTop: 0 }}>Define quién revisa y aprueba el documento antes de su publicación.</p>
            <div className="form-grid">
              <div className="form-row"><label>Revisor</label><select className="input" value={f.revisor} onChange={e => set('revisor', e.target.value)}><option value="">Seleccionar…</option>{DATA.USERS.filter(u => ['revisor', 'lider', 'editor'].includes(u.role)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="form-row"><label>Aprobador</label><select className="input" value={f.aprobador} onChange={e => set('aprobador', e.target.value)}><option value="">Seleccionar…</option>{DATA.USERS.filter(u => ['aprobador', 'lider', 'admin'].includes(u.role)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            </div>
            <div className="card summary-card">
              <h4 style={{ margin: '0 0 14px', fontSize: 13 }}>Resumen del documento</h4>
              <div className="spec-list">
                <div className="spec-row"><span className="k">Nombre</span><span className="v">{f.name || '—'}</span></div>
                <div className="spec-row"><span className="k">Tipo</span><span className="v">{typeCode ? typeCode.name : '—'}</span></div>
                <div className="spec-row"><span className="k">Área</span><span className="v">{areaCode ? areaCode.name : '—'}</span></div>
                <div className="spec-row"><span className="k">Código</span><span className="v mono">{autoCode}</span></div>
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

export function WorkflowView({ nav }) {
  const flowSteps = [
    { k: 'creacion', label: 'Creación / Carga', icon: 'upload', desc: 'El editor crea o carga el documento' },
    { k: 'revision', label: 'Revisión', icon: 'eye', desc: 'El responsable del área revisa' },
    { k: 'aprobacion', label: 'Aprobación', icon: 'check', desc: 'El líder o autoridad aprueba' },
    { k: 'publicacion', label: 'Publicación', icon: 'send', desc: 'Se publica y notifica' },
    { k: 'archivo', label: 'Archivo', icon: 'archive', desc: 'Versiones obsoletas se archivan' },
  ];
  const stages = [
    { k: 'creacion', label: 'En creación', tone: 'borrador' },
    { k: 'revision', label: 'En revisión', tone: 'revision' },
    { k: 'aprobacion', label: 'En aprobación', tone: 'publicado' },
  ];
  const items = DATA.WORKFLOW.map(w => ({ ...w, doc: DATA.docById(w.docId) }));
  const prioColor = { alta: 'var(--st-vencido-fg)', media: 'var(--st-revision-fg)', baja: 'var(--ink-400)' };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Gestión</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Revisión y aprobación</span></div>
        <h1 className="page-title">Flujo de revisión y aprobación</h1>
        <p className="page-sub">{items.length} documentos en proceso · ciclo de vida documental</p>
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
          const col = items.filter(it => it.stage === st.k);
          return (
            <div key={st.k}>
              <div className="row between mb-12 kanban-header">
                <span className="row gap-8" style={{ fontWeight: 700, fontSize: 13.5 }}><span className={'badge badge-' + st.tone} style={{ padding: '2px 8px' }}><span className="b-dot"></span>{st.label}</span></span>
                <span className="text-xs muted mono">{col.length}</span>
              </div>
              <div className="kanban-col">
                {col.length === 0 ? <div className="text-xs muted kanban-empty">Sin documentos</div> : col.map(it => (
                  <div key={it.id} className="card kanban-card" onClick={() => nav('detail', { id: it.doc.id })} role="button" tabIndex={0}>
                    <div className="row between mb-12"><AreaTag areaId={it.doc.area} /><span className="priority-label" style={{ color: prioColor[it.priority] }}>{it.priority}</span></div>
                    <div className="text-sm" style={{ fontWeight: 600, lineHeight: 1.3 }}>{it.doc.name}</div>
                    <div className="mono text-xs muted" style={{ marginTop: 5 }}>{it.doc.code} · v{it.doc.version}</div>
                    <div className="row gap-8 kanban-assignee">
                      <Avatar name={it.assignee} size={24} /><span className="text-xs muted grow assignee-name">{it.assignee}</span><span className="text-xs muted">{DATA.fmtDate(it.since)}</span>
                    </div>
                    {st.k !== 'creacion' && (
                      <div className="row gap-8 mt-12">
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={(e) => e.stopPropagation()} type="button"><Icon name="check" size={14} />{st.k === 'revision' ? 'Aprobar' : 'Publicar'}</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => e.stopPropagation()} type="button"><Icon name="x" size={14} /></button>
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
  const [tab, setTab] = useState('users');
  const permLabels = { crear: 'Crear', editar: 'Editar', aprobar: 'Aprobar', publicar: 'Publicar', archivar: 'Archivar', consultar: 'Consultar', descargar: 'Descargar' };
  const permKeys = Object.keys(permLabels);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Gestión</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Usuarios y roles</span></div>
        <div className="row between wrap gap-12"><div><h1 className="page-title">Administración de usuarios y roles</h1><p className="page-sub">{DATA.USERS.length} usuarios · {DATA.ROLES.length} roles definidos</p></div><button className="btn btn-primary"><Icon name="plus" size={16} />Invitar usuario</button></div>
      </div>
      <div className="seg mb-24">
        <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Icon name="users" size={15} />Usuarios</button>
        <button type="button" className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}><Icon name="shield" size={15} />Roles y permisos</button>
      </div>
      {tab === 'users' ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Área</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {DATA.USERS.map(u => {
                const role = DATA.roleById(u.role);
                const ar = u.area ? DATA.areaById(u.area) : null;
                return (
                  <tr key={u.id}>
                    <td><div className="row gap-10"><Avatar name={u.name} size={32} /><span style={{ fontWeight: 600 }}>{u.name}</span></div></td>
                    <td className="text-sm muted">{u.email}</td>
                    <td><span className="tag tag-type">{role.name}</span></td>
                    <td>{ar ? <AreaTag areaId={u.area} /> : <span className="text-xs muted">Transversal</span>}</td>
                    <td className="text-sm muted">{DATA.fmtDate(u.last)}</td>
                    <td><span className={'badge badge-' + (u.status === 'Activo' ? 'aprobado' : 'archivado')}><span className="b-dot"></span>{u.status}</span></td>
                    <td><button className="tbar-icon-btn" style={{ color: 'var(--ink-400)', width: 32, height: 32 }} type="button"><Icon name="dots" size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <div className="roles-grid">
            {DATA.ROLES.map(r => (
              <div key={r.id} className="card" style={{ padding: 18 }}>
                <div className="row gap-10 mb-12"><span className="kpi-ico" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-50)', color: 'var(--brand-700)' }}><Icon name="shield" size={18} /></span><span style={{ fontSize: 14.5, fontWeight: 700 }}>{r.name}</span></div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-600)', margin: 0, lineHeight: 1.5 }}>{r.desc}</p>
                <div className="row gap-6 wrap mt-12">{permKeys.filter(k => r.perms[k]).map(k => <span key={k} className="tag" style={{ padding: '1px 7px', fontSize: 11 }}>{permLabels[k]}</span>)}</div>
              </div>
            ))}
          </div>
          <h3 className="section-title">Matriz de permisos</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Rol</th>{permKeys.map(k => <th key={k} style={{ textAlign: 'center' }}>{permLabels[k]}</th>)}</tr></thead>
              <tbody>
                {DATA.ROLES.map(r => (
                  <tr key={r.id} style={{ cursor: 'default' }}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    {permKeys.map(k => <td key={k} style={{ textAlign: 'center' }}>{r.perms[k] ? <Icon name="check" size={17} style={{ color: 'var(--brand-600)' }} /> : <span style={{ color: 'var(--ink-300)' }}>—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
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
  const byArea = DATA.AREAS.map(a => ({ label: a.code, value: docs.filter(d => d.area === a.id).length, color: a.color }));
  const byState = Object.keys(DATA.STATES).map(s => ({ label: DATA.STATES[s].label, value: docs.filter(d => d.state === s).length, color: `var(--st-${DATA.STATES[s].cls}-fg)` }));
  const byType = DATA.TYPES.map(t => ({ label: t.name, value: docs.filter(d => d.type === t.id).length })).filter(x => x.value).sort((a, b) => b.value - a.value);
  const topViews = [...docs].sort((a, b) => b.views - a.views).slice(0, 6);
  const avgVers = (docs.reduce((s, d) => s + d.history.length, 0) / docs.length).toFixed(1);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Reportes e indicadores</span></div>
        <div className="row between wrap gap-12"><div><h1 className="page-title">Reportes e indicadores de gestión</h1><p className="page-sub">Estado del repositorio documental · corte 11 jun 2026</p></div><button className="btn btn-ghost"><Icon name="download" size={16} />Exportar informe</button></div>
      </div>
      <div className="grid-kpi mb-24">
        <KpiCard icon="check" value={docs.filter(d => ['publicado', 'aprobado'].includes(d.state)).length} label="Documentos vigentes" tone="brand" />
        <KpiCard icon="alert" value={docs.filter(d => d.state === 'vencido').length} label="Documentos vencidos" tone="red" />
        <KpiCard icon="clock" value={docs.filter(d => d.state === 'revision').length} label="Pendientes de revisión" tone="amber" />
        <KpiCard icon="history" value={'4.2 días'} label="Tiempo prom. de aprobación" tone="blue" />
        <KpiCard icon="doc" value={avgVers} label="Versiones por documento" tone="gray" />
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

export function LoginView() {
  const { login, loginWithMicrosoft, loading, error } = useAuth();
  const [email, setEmail] = useState('mlopez@institucion.edu.co');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [msLoading, setMsLoading] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    try {
      await login(email, password || 'demo1234');
    } catch { /* error shown via context */ }
  };

  const handleMicrosoft = async () => {
    setMsLoading(true);
    try {
      await loginWithMicrosoft();
    } catch { /* error shown via context */ }
    finally { setMsLoading(false); }
  };

  return (
    <div className="login-layout">
      <div className="login-hero">
        <div className="hero-bg-circle hero-bg-circle-1"></div>
        <div className="hero-bg-circle hero-bg-circle-2"></div>
        <div className="row gap-12 login-brand">
          <span className="brand-mark" style={{ width: 40, height: 40 }}><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M4 19V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-2zM10 3h2v18h-2zM15.5 3.5l3.8 1 3.7 14.5-3.8 1z" /></svg></span>
          <div><div style={{ fontWeight: 800, fontSize: 22 }}>Acervo</div><div className="login-brand-sub">Operaciones</div></div>
        </div>
        <div className="login-hero-content">
          <h1 className="login-hero-title">Centro de Conocimiento Operativo</h1>
          <p className="login-hero-desc">El repositorio vivo del Área de Operaciones. Manuales, procedimientos, ANS y descriptores de cargo — centralizados, trazables y siempre a la mano.</p>
          <div className="row gap-16 mt-24 login-areas">
            {['Fábrica de Contenidos', 'Prácticas', 'Homologaciones', 'Op. Pregrado', 'Op. Posgrado', 'Pruebas Saber'].map(a => <span key={a} className="login-area-chip">{a}</span>)}
          </div>
        </div>
        <div className="login-footer">© 2026 · Plataforma institucional de gestión documental</div>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={handleLogin}>
          <h2 className="login-form-title">Iniciar sesión</h2>
          <p className="muted login-form-sub">Ingresa con tu cuenta institucional</p>
          {error && <div className="login-error"><Icon name="alert" size={16} />{error}</div>}
          <div className="form-row"><label>Correo institucional</label><div className="field" style={{ padding: '11px 13px' }}><Icon name="mail" size={16} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@institucion.edu.co" style={{ width: '100%' }} required /></div></div>
          <div className="form-row"><label>Contraseña</label><div className="field" style={{ padding: '11px 13px' }}><Icon name="lock" size={16} /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ width: '100%' }} /></div></div>
          <div className="row between mb-16 login-options"><label className="filter-opt" style={{ padding: 0 }}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span className="text-sm">Recordarme</span></label><span className="link text-sm">¿Olvidaste tu contraseña?</span></div>
          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}<Icon name="arrowRight" size={17} /></button>
          <div className="row gap-10 mt-24 login-divider"><div className="login-divider-line"></div><span className="text-xs muted">o</span><div className="login-divider-line"></div></div>
          <button className="btn btn-ghost mt-16 login-ms" type="button" disabled={msLoading} onClick={handleMicrosoft}><Icon name="building" size={17} />{msLoading ? 'Conectando con Microsoft 365…' : 'Continuar con Microsoft 365'}</button>
          <p className="text-xs muted mt-20" style={{ textAlign: 'center', lineHeight: 1.5 }}>Demo: usa cualquier correo de {DATA.USERS.length} usuarios registrados con contraseña de 4+ caracteres.</p>
        </form>
      </div>
    </div>
  );
}
