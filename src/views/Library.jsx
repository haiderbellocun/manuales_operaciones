import { useState, useMemo, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useCatalogs } from '../context/CatalogContext';
import { STATES, fmtDate, fmtDateTime } from '../utils/display';
import { Icon, StateBadge, AreaTag, DocCard, Avatar, FilterToggleButton, SelectField } from '../components';
import {
  DocumentPreview,
  FileDropzone,
  InfographicDropzone,
  validateInfographic,
} from '../components/DocumentPreview';
import { DocumentInfographic } from '../components/DocumentInfographic';
import { DocumentHoverPreview } from '../components/DocumentHoverPreview';
import {
  OPERATION_ACADEMIC_AREA_ID,
  OPERATION_ACADEMIC_FULL_ROLE_ID,
} from '../utils/areas';
import { getErrorToastType, getUserErrorMessage } from '../utils/errors';

function FilterRail({ docs, filt, setFilt, className }) {
  const { areas, coordinations, types } = useCatalogs();
  const countBy = (key, val) => docs.filter(d => Number(d[key]) === Number(val)).length;
  const countByAreaCoordination = (areaId, coordinationId) => docs.filter(d => (
    Number(d.area) === Number(areaId)
    && (
      Number(d.coordination) === Number(coordinationId)
      || (
        Number(areaId) === OPERATION_ACADEMIC_AREA_ID
        && !d.coordination
      )
    )
  )).length;
  const toggle = (key, val) => {
    const arr = filt[key].includes(val) ? filt[key].filter(x => x !== val) : [...filt[key], val];
    setFilt({ ...filt, [key]: arr });
  };
  const toggleArea = (area) => {
    const childIds = coordinations
      .filter(coordination => Number(coordination.areaId) === Number(area.id))
      .map(coordination => Number(coordination.id));
    const nextAreas = filt.areas.includes(area.id)
      ? filt.areas.filter(id => Number(id) !== Number(area.id))
      : [...filt.areas, area.id];
    setFilt({
      ...filt,
      areas: nextAreas,
      coordinations: filt.coordinations.filter(id => !childIds.includes(Number(id))),
    });
  };
  const activeCount = filt.areas.length + filt.coordinations.length + filt.types.length + filt.states.length + (filt.fav ? 1 : 0);

  return (
    <aside className={'filter-rail ' + (className || '')}>
      <div className="row between mb-16">
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Filtros</h4>
        {activeCount > 0 ?
          <span className="link" style={{ fontSize: 12 }} onClick={() => setFilt({ ...filt, areas: [], coordinations: [], types: [], states: [], fav: false })}>Limpiar</span> : null}
      </div>
      <div className="filter-group">
        <h4>Área</h4>
        {areas.map(a => {
          const c = countBy('area', a.id);
          const childCoordinations = a.requiresCoordination
            ? coordinations.filter(coordination => Number(coordination.areaId) === Number(a.id))
            : [];
          if (!c && !filt.areas.includes(a.id) && !childCoordinations.some(coordination => filt.coordinations.includes(coordination.id))) return null;
          return (
            <div key={a.id} className="filter-area-block">
              <label className="filter-opt">
                <input type="checkbox" checked={filt.areas.includes(a.id)} onChange={() => toggleArea(a)} />
                <span className="area-dot" style={{ background: a.color }}></span>
                <span className="grow" style={{ fontSize: 12.5 }}>{a.abbreviation}</span>
                <span className="cnt">{c}</span>
              </label>
              {childCoordinations.map(coordination => {
                const cc = countByAreaCoordination(a.id, coordination.id);
                if (!cc && !filt.coordinations.includes(coordination.id)) return null;
                return (
                  <label key={coordination.id} className="filter-opt filter-opt-child">
                    <input
                      type="checkbox"
                      checked={filt.coordinations.includes(coordination.id)}
                      onChange={() => setFilt({
                        ...filt,
                        areas: filt.areas.filter(id => Number(id) !== Number(a.id)),
                        coordinations: filt.coordinations.includes(coordination.id)
                          ? filt.coordinations.filter(id => Number(id) !== Number(coordination.id))
                          : [...filt.coordinations, coordination.id],
                      })}
                    />
                    <span className="area-dot" style={{ background: a.color }}></span>
                    <span className="grow" style={{ fontSize: 12.5 }}>{coordination.abbreviation}</span>
                    <span className="cnt">{cc}</span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="filter-group">
        <h4>Tipo documental</h4>
        {types.map(t => {
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
        {Object.keys(STATES).map(s => {
          const c = countBy('state', s);
          if (!c) return null;
          return (
            <label key={s} className="filter-opt">
              <input type="checkbox" checked={filt.states.includes(s)} onChange={() => toggle('states', s)} />
              <span className="grow">{STATES[s].label}</span>
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

function HybridRow({ doc, nav, toggleFav, onPreviewStart, onPreviewEnd }) {
  const { areaById, typeById, personById } = useCatalogs();
  const area = areaById(doc.area);
  const type = typeById(doc.type);
  const owner = personById(doc.owner);
  const areaColor = area?.color || 'var(--brand-700)';
  return (
    <div
      className="card hybrid-row"
      onClick={() => nav('detail', { id: doc.id })}
      onMouseEnter={event => onPreviewStart?.(doc, event.currentTarget)}
      onMouseLeave={() => onPreviewEnd?.()}
      onFocus={event => onPreviewStart?.(doc, event.currentTarget)}
      onBlur={() => onPreviewEnd?.()}
      role="button"
      tabIndex={0}
    >
      <div className="hybrid-accent" style={{ background: areaColor }}></div>
      <div className="hybrid-content">
        <span className="kpi-ico hybrid-icon"><Icon name={type?.icon || 'doc'} size={21} /></span>
        <div className="hybrid-main">
          <div className="hybrid-title">{doc.name}</div>
          <div className="row gap-8 text-xs muted wrap hybrid-meta">
            <span className="mono">{doc.documentNumber} · v{doc.version}</span>
            <span style={{ color: 'var(--line)' }}>•</span>
            <span className="tag tag-type" style={{ padding: '1px 7px' }}>{type?.name || 'Tipo no disponible'}</span>
            <span style={{ color: 'var(--line)' }}>•</span>
            <span>Resp. {owner?.name || 'No disponible'}</span>
            <span style={{ color: 'var(--line)' }}>•</span>
            <span>Act. {fmtDate(doc.updated)}</span>
          </div>
        </div>
        <div className="row gap-12 hybrid-actions">
          <AreaTag areaId={doc.area} coordinationId={doc.coordination} />
          <StateBadge state={doc.state} />
          <button className={'doc-fav' + (doc.fav ? ' on' : '')} onClick={(e) => { e.stopPropagation(); toggleFav(doc.id); }} aria-label="Favorito"><Icon name="star" size={18} /></button>
        </div>
      </div>
    </div>
  );
}

export function Library({ nav, docs, toggleFav, initParams, showToast }) {
  const { hasPermission } = useAuth();
  const { areaById, coordinationById, typeById, personById } = useCatalogs();
  const canCreate = hasPermission('crear');
  const savedPrefs = storage.getLibraryPrefs();
  const toNumberList = (values = []) => values.map(v => Number(v)).filter(Number.isFinite);
  const [filt, setFilt] = useState({
    q: '',
    areas: initParams?.area ? [Number(initParams.area)] : toNumberList(savedPrefs.filt?.areas || []),
    coordinations: initParams?.coordination ? [Number(initParams.coordination)] : (initParams?.area ? [] : toNumberList(savedPrefs.filt?.coordinations || [])),
    types: initParams?.type ? [Number(initParams.type)] : toNumberList(savedPrefs.filt?.types || []),
    states: savedPrefs.filt?.states || [],
    fav: initParams?.fav ?? savedPrefs.filt?.fav ?? false,
    sort: savedPrefs.sort || 'updated',
  });
  const [view, setView] = useState(savedPrefs.view || 'cards');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  const saveTimer = useRef(null);
  const previewTimer = useRef(null);

  const handleToggleFavorite = async (docId) => {
    try {
      const isFavorite = await toggleFav(docId);
      showToast?.({
        title: isFavorite ? 'Documento agregado a favoritos' : 'Documento retirado de favoritos',
        message: isFavorite
          ? 'Podrás encontrarlo rápidamente desde la vista de favoritos.'
          : 'El documento ya no aparece en tu lista de favoritos.',
        type: 'success',
      });
    } catch (error) {
      showToast?.({
        title: 'No se pudo actualizar el favorito',
        message: getUserErrorMessage(error, 'No se pudo actualizar la lista de favoritos.'),
        type: getErrorToastType(error),
      });
    }
  };

  const showDocumentPreview = (doc, element) => {
    if (window.matchMedia?.('(hover: none), (pointer: coarse)').matches) return;
    clearTimeout(previewTimer.current);
    const rect = element.getBoundingClientRect();
    const anchorRect = {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
    previewTimer.current = setTimeout(() => {
      setHoverPreview({ doc, anchorRect });
    }, 180);
  };

  const hideDocumentPreview = () => {
    clearTimeout(previewTimer.current);
    setHoverPreview(null);
  };

  useEffect(() => {
    const hideOnViewportChange = () => hideDocumentPreview();
    window.addEventListener('scroll', hideOnViewportChange, true);
    window.addEventListener('resize', hideOnViewportChange);
    return () => {
      clearTimeout(previewTimer.current);
      window.removeEventListener('scroll', hideOnViewportChange, true);
      window.removeEventListener('resize', hideOnViewportChange);
    };
  }, []);

  useEffect(() => {
    if (initParams?.area || initParams?.coordination) {
      setFilt(f => ({
        ...f,
        areas: initParams?.coordination ? [] : (initParams?.area ? [Number(initParams.area)] : f.areas),
        coordinations: initParams?.coordination ? [Number(initParams.coordination)] : [],
      }));
    }
    if (initParams?.fav) setFilt(f => ({ ...f, fav: true }));
  }, [initParams?.area, initParams?.coordination, initParams?.fav]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storage.saveLibraryPrefs({ view, sort: filt.sort, filt: { areas: filt.areas, coordinations: filt.coordinations, types: filt.types, states: filt.states, fav: filt.fav } });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [view, filt.sort, filt.areas, filt.coordinations, filt.types, filt.states, filt.fav]);

  const filtered = useMemo(() => {
    let r = docs.filter(d => {
      if (filt.areas.length && !filt.areas.includes(d.area)) return false;
      if (
        filt.coordinations.length
        && !filt.coordinations.includes(d.coordination)
        && !(
          Number(d.area) === OPERATION_ACADEMIC_AREA_ID
          && !d.coordination
        )
      ) return false;
      if (filt.types.length && !filt.types.includes(d.type)) return false;
      if (filt.states.length && !filt.states.includes(d.state)) return false;
      if (filt.fav && !d.fav) return false;
      if (filt.q) {
        const q = filt.q.toLowerCase();
        const hay = (d.name + ' ' + d.documentNumber + ' ' + (d.tags || []).join(' ') + ' ' + d.desc).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const s = filt.sort;
    r = [...r].sort((a, b) =>
      s === 'updated' ? b.updated.localeCompare(a.updated)
        : s === 'name' ? a.name.localeCompare(b.name)
          : s === 'views' ? b.views - a.views
            : a.documentNumber.localeCompare(b.documentNumber));
    return r;
  }, [docs, filt]);

  const areaName = initParams?.area ? areaById(initParams.area)?.name : null;
  const coordinationName = initParams?.coordination ? coordinationById(initParams.coordination)?.name : null;
  const libraryName = coordinationName || areaName;
  const activeFilterCount = filt.areas.length + filt.coordinations.length + filt.types.length + filt.states.length + (filt.fav ? 1 : 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb">
          <a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span>
          <span>Biblioteca documental{libraryName ? ' / ' + libraryName : ''}</span>
        </div>
        <div className="row between wrap gap-12">
          <div>
            <h1 className="page-title">Biblioteca documental</h1>
            <p className="page-sub">{filtered.length} de {docs.length} documentos · repositorio operativo centralizado</p>
          </div>
          {canCreate && <button className="btn btn-primary" onClick={() => nav('upload')}><Icon name="upload" size={16} />Cargar documento</button>}
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
              <SelectField
                className="field-select"
                value={filt.sort}
                onChange={value => setFilt({ ...filt, sort: value })}
                options={[
                  { value: 'updated', label: 'Actualizaci\u00f3n' },
                  { value: 'name', label: 'Nombre' },
                  { value: 'documentNumber', label: 'N\u00famero documental' },
                  { value: 'views', label: 'M\u00e1s consultados' },
                ]}
              />
            </div>
            <div className="seg view-seg">
              <button type="button" className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')} title="Tarjetas"><Icon name="cards" size={15} /><span className="seg-label">Tarjetas</span></button>
              <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} title="Tabla"><Icon name="table" size={15} /><span className="seg-label">Tabla</span></button>
              <button type="button" className={view === 'hybrid' ? 'active' : ''} onClick={() => setView('hybrid')} title="Híbrida"><Icon name="hybrid" size={15} /><span className="seg-label">Híbrida</span></button>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="row gap-8 wrap mb-16">
              {filt.areas.map(a => <span key={a} className="chip active" onClick={() => setFilt({ ...filt, areas: filt.areas.filter(x => x !== a) })}>{areaById(a)?.abbreviation || a} <Icon name="x" size={12} /></span>)}
              {filt.coordinations.map(c => <span key={c} className="chip active" onClick={() => setFilt({ ...filt, coordinations: filt.coordinations.filter(x => x !== c) })}>{coordinationById(c)?.abbreviation || c} <Icon name="x" size={12} /></span>)}
              {filt.types.map(t => <span key={t} className="chip active" onClick={() => setFilt({ ...filt, types: filt.types.filter(x => x !== t) })}>{typeById(t)?.name || t} <Icon name="x" size={12} /></span>)}
              {filt.states.map(s => <span key={s} className="chip active" onClick={() => setFilt({ ...filt, states: filt.states.filter(x => x !== s) })}>{STATES[s].label} <Icon name="x" size={12} /></span>)}
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
              {filtered.map(d => (
                <DocCard
                  key={d.id}
                  doc={d}
                  onOpen={(id) => nav('detail', { id })}
                  onFav={handleToggleFavorite}
                  onPreviewStart={showDocumentPreview}
                  onPreviewEnd={hideDocumentPreview}
                />
              ))}
            </div>
          ) : view === 'table' ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Documento</th><th>Código</th><th>Tipo</th><th>Área</th><th>Versión</th><th>Responsable</th><th>Actualizado</th><th>Estado</th></tr></thead>
                <tbody>
                  {filtered.map(d => (
                    <tr
                      key={d.id}
                      onClick={() => nav('detail', { id: d.id })}
                      onMouseEnter={event => showDocumentPreview(d, event.currentTarget)}
                      onMouseLeave={hideDocumentPreview}
                    >
                      <td className="col-name">{d.name}</td>
                      <td className="col-number">{d.documentNumber}</td>
                      <td>{typeById(d.type)?.name || 'Tipo no disponible'}</td>
                      <td><AreaTag areaId={d.area} coordinationId={d.coordination} /></td>
                      <td className="mono text-xs">v{d.version}</td>
                      <td className="text-sm">{personById(d.owner)?.name || 'No disponible'}</td>
                      <td className="text-sm muted">{fmtDate(d.updated)}</td>
                      <td><StateBadge state={d.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hybrid-list">
              {filtered.map(d => (
                <HybridRow
                  key={d.id}
                  doc={d}
                  nav={nav}
                  toggleFav={handleToggleFavorite}
                  onPreviewStart={showDocumentPreview}
                  onPreviewEnd={hideDocumentPreview}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {hoverPreview && (
        <DocumentHoverPreview doc={hoverPreview.doc} anchorRect={hoverPreview.anchorRect} />
      )}
    </div>
  );
}

function nextVersion(current) {
  const parts = String(current || '1.0').split('.');
  const major = Number(parts[0]) || 1;
  const minor = Number(parts[1]) || 0;
  return `${major}.${minor + 1}`;
}

function canEditDocumentScope(user, doc, canAdmin) {
  if (canAdmin) return true;
  if (!user || !doc || Number(user.area) !== Number(doc.area)) return false;

  if (Number(doc.area) === OPERATION_ACADEMIC_AREA_ID) {
    if (Number(user.role) === OPERATION_ACADEMIC_FULL_ROLE_ID) return true;
    return Boolean(user.coordination)
      && Number(user.coordination) === Number(doc.coordination || 0);
  }

  if (user.coordination) {
    return Number(user.coordination) === Number(doc.coordination || 0);
  }
  return true;
}

export function DocDetail({ nav, docId, docs, toggleFav, requestUpdate, showToast, onVersionCreated }) {
  const { user, hasPermission } = useAuth();
  const { people, areaById, coordinationById, typeById, personById } = useCatalogs();
  const numericDocId = Number(docId);
  const localDoc = docs.find(d => Number(d.id) === numericDocId);
  const [remoteDoc, setRemoteDoc] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(() => !localDoc && Number.isFinite(numericDocId));
  const doc = remoteDoc || localDoc;
  const [tab, setTab] = useState('info');
  const [versionModal, setVersionModal] = useState(false);
  const [versionForm, setVersionForm] = useState({ version: '', note: '', vigencia: '', desc: '' });
  const [versionFile, setVersionFile] = useState(null);
  const [versionInfographic, setVersionInfographic] = useState(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', owner: '', vigencia: '', desc: '', tags: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingInfographic, setSavingInfographic] = useState(false);
  const viewed = useRef(false);
  const canDownload = hasPermission('descargar');
  const canEditScope = canEditDocumentScope(user, doc, hasPermission('administrar'));
  const canCreateVersion = hasPermission('editar')
    && canEditScope
    && ['publicado', 'vencido', 'archivado'].includes(doc?.state);
  const canEditDocument = hasPermission('editar') && canEditScope && doc?.state === 'borrador';

  const handleToggleFavorite = async () => {
    try {
      const isFavorite = await toggleFav(doc.id);
      setRemoteDoc(current => ({ ...(current || doc), fav: isFavorite }));
      showToast?.({
        title: isFavorite ? 'Documento agregado a favoritos' : 'Documento retirado de favoritos',
        message: isFavorite
          ? 'Podrás encontrarlo rápidamente desde la vista de favoritos.'
          : 'El documento ya no aparece en tu lista de favoritos.',
        type: 'success',
      });
    } catch (error) {
      showToast?.({
        title: 'No se pudo actualizar el favorito',
        message: getUserErrorMessage(error, 'No se pudo actualizar la lista de favoritos.'),
        type: getErrorToastType(error),
      });
    }
  };

  const handleDownload = async () => {
    showToast?.({ title: 'Preparando descarga', message: 'Estamos recuperando el archivo vigente.', type: 'info', duration: 10000 });
    try {
      const record = await api.getDocumentFileUrl(doc.id);
      if (!record?.blob) throw new Error('El documento no tiene un archivo disponible para descargar.');
      setRemoteDoc(current => ({
        ...(current || doc),
        downloads: record.downloads ?? Number((current || doc).downloads || 0) + 1,
        lastDownloadedAt: record.lastDownloadedAt || new Date().toISOString(),
      }));
      const url = URL.createObjectURL(record.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.name || `${doc.documentNumber}.bin`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast?.({ title: 'Descarga iniciada', message: `Se inició la descarga de ${record.name || doc.name}.`, type: 'success' });
    } catch (error) {
      showToast?.({
        title: 'No se pudo descargar el documento',
        message: getUserErrorMessage(error, 'No se pudo recuperar el archivo del documento.'),
        type: getErrorToastType(error),
      });
    }
  };

  const handleVersionDownload = async (versionId) => {
    showToast?.({ title: 'Preparando versión histórica', message: 'Estamos recuperando el archivo seleccionado.', type: 'info', duration: 10000 });
    try {
      const record = await api.getDocumentVersionFileUrl(doc.id, versionId);
      if (!record?.blob) throw new Error('La versión seleccionada no tiene un archivo disponible.');
      setRemoteDoc(current => ({
        ...(current || doc),
        downloads: record.downloads ?? Number((current || doc).downloads || 0) + 1,
        lastDownloadedAt: record.lastDownloadedAt || new Date().toISOString(),
      }));
      const url = URL.createObjectURL(record.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.name || `${doc.documentNumber}-version.bin`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast?.({ title: 'Descarga iniciada', message: 'La versión histórica comenzó a descargarse.', type: 'success' });
    } catch (error) {
      showToast?.({
        title: 'No se pudo descargar la versión',
        message: getUserErrorMessage(error, 'No se pudo recuperar el archivo de esta versión.'),
        type: getErrorToastType(error),
      });
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: doc.name,
      text: `${doc.documentNumber} · ${doc.name}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
      } else {
        throw new Error('El navegador no permite compartir este enlace.');
      }
      showToast?.({ title: 'Documento listo para compartir', message: 'El enlace del documento fue compartido o copiado correctamente.', type: 'success' });
    } catch (err) {
      if (err?.name !== 'AbortError') {
        showToast?.({
          title: 'No se pudo compartir el documento',
          message: getUserErrorMessage(err, 'No se pudo compartir el enlace del documento.'),
          type: getErrorToastType(err),
        });
      }
    }
  };

  const openVersionModal = () => {
    setVersionForm({ version: nextVersion(doc.version), note: '', vigencia: '', desc: '' });
    setVersionFile(null);
    setVersionInfographic(null);
    setVersionModal(true);
  };

  const submitVersion = async () => {
    if (!versionFile) {
      showToast?.('Selecciona el archivo de la nueva versión.', 'warning');
      return;
    }
    if (versionInfographic) {
      const validationError = validateInfographic(versionInfographic);
      if (validationError) {
        showToast?.(validationError, 'warning');
        return;
      }
    }
    setSavingVersion(true);
    showToast?.({
      title: 'Creando nueva versión',
      message: `Estamos cargando el archivo de la versión ${versionForm.version}${versionInfographic ? ' y su nueva infografía' : ''}.`,
      type: 'info',
      duration: 15000,
    });
    try {
      const updated = await api.createDocumentVersion(
        doc.id,
        versionForm,
        versionFile,
        versionInfographic,
      );
      setRemoteDoc(updated);
      await onVersionCreated?.();
      setVersionModal(false);
      showToast?.({
        title: `Versión ${updated.version} creada`,
        message: 'El documento quedó en Borrador y debe iniciar nuevamente el flujo de revisión y publicación.',
        type: 'success',
      });
    } catch (err) {
      showToast?.({
        title: 'No se pudo crear la nueva versión',
        message: getUserErrorMessage(err, 'No se pudo crear la nueva versión del documento.'),
        type: getErrorToastType(err),
      });
    } finally {
      setSavingVersion(false);
    }
  };

  const openEditModal = () => {
    setEditForm({
      name: doc.name || '',
      owner: doc.owner || '',
      vigencia: doc.vigencia && doc.vigencia !== '—' ? doc.vigencia : '',
      desc: doc.desc || '',
      tags: (doc.tags || []).join(', '),
    });
    setEditModal(true);
  };

  const submitEdit = async () => {
    setSavingEdit(true);
    showToast?.({ title: 'Guardando cambios', message: 'Estamos actualizando los datos del documento.', type: 'info', duration: 10000 });
    try {
      const updated = await api.updateDocument(doc.id, editForm);
      setRemoteDoc(updated);
      await onVersionCreated?.();
      setEditModal(false);
      showToast?.({ title: 'Documento actualizado', message: 'Los datos del documento se guardaron correctamente.', type: 'success' });
    } catch (err) {
      showToast?.({
        title: 'No se pudo actualizar el documento',
        message: getUserErrorMessage(err, 'No se pudieron guardar los cambios del documento.'),
        type: getErrorToastType(err),
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const replaceInfographic = async (file) => {
    const validationError = validateInfographic(file);
    if (validationError) {
      showToast?.(validationError, 'warning');
      return;
    }
    setSavingInfographic(true);
    showToast?.({ title: 'Actualizando infografía', message: 'Estamos cargando la nueva imagen informativa.', type: 'info', duration: 10000 });
    try {
      const meta = await api.uploadDocumentInfographic(doc.id, file);
      setRemoteDoc(current => ({
        ...(current || doc),
        infographic: { available: true, ...meta },
      }));
      await onVersionCreated?.();
      showToast?.({ title: 'Infografía actualizada', message: 'La nueva infografía ya acompaña al documento.', type: 'success' });
    } catch (err) {
      showToast?.({
        title: 'No se pudo actualizar la infografía',
        message: getUserErrorMessage(err, 'No se pudo guardar la nueva infografía.'),
        type: getErrorToastType(err),
      });
    } finally {
      setSavingInfographic(false);
    }
  };

  useEffect(() => {
    setRemoteDoc(null);
    viewed.current = false;
    setTab('info');
  }, [numericDocId]);

  useEffect(() => {
    if (doc && !viewed.current) {
      viewed.current = true;
      api.incrementViews(doc.id)
        .then(metrics => {
          setRemoteDoc(current => ({
            ...(current || doc),
            views: metrics.views,
            downloads: metrics.downloads,
            lastViewedAt: metrics.lastViewedAt,
            lastDownloadedAt: metrics.lastDownloadedAt,
          }));
        })
        .catch(() => {});
    }
  }, [doc?.id]);

  useEffect(() => {
    if (localDoc) {
      setLoadingDoc(false);
      return;
    }
    if (!Number.isFinite(numericDocId)) return;
    setLoadingDoc(true);
    api.getDocument(numericDocId)
      .then(setRemoteDoc)
      .catch(() => setRemoteDoc(null))
      .finally(() => setLoadingDoc(false));
  }, [localDoc, numericDocId]);

  if (loadingDoc) {
    return (
      <div className="page">
        <div className="card empty-state">
          <Icon name="clock" size={32} style={{ color: 'var(--brand-500)' }} />
          <p className="muted mt-16">Cargando documento...</p>
        </div>
      </div>
    );
  }

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

  const area = areaById(doc.area);
  const coordination = doc.coordination ? coordinationById(doc.coordination) : null;
  const type = typeById(doc.type);
  const owner = personById(doc.owner);
  const areaColor = area?.color || 'var(--brand-700)';
  const typeIcon = type?.icon || 'doc';
  const related = (doc.related || [])
    .map(id => docs.find(d => Number(d.id) === Number(id)))
    .filter(Boolean);

  const contextLink = doc.ans ? { label: 'Ver ficha ANS completa', view: 'ansDetail', params: { id: doc.ans } }
    : doc.cargo ? { label: 'Ver descriptor de cargo', view: 'cargoDetail', params: { id: doc.cargo } }
      : doc.app ? { label: 'Ver ficha de aplicación', view: 'appDetail', params: { id: doc.app } } : null;

  return (
    <div className="page fade-in">
      <div className="breadcrumb">
        <a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span>
        <a onClick={() => nav('library')}>Biblioteca</a><span className="sep">/</span>
        <a onClick={() => nav('library', { area: doc.area })}>{area?.name || 'Área'}</a><span className="sep">/</span>
        {coordination && <><a onClick={() => nav('library', { area: doc.area, coordination: doc.coordination })}>{coordination.name}</a><span className="sep">/</span></>}
        <span style={{ color: 'var(--ink-700)' }}>{doc.documentNumber}</span>
      </div>

      <div className="card doc-header">
        <div className="doc-header-accent" style={{ background: areaColor }}></div>
        <div className="doc-header-body">
          <div className="row between wrap gap-16">
            <div className="row gap-16 doc-header-info">
              <span className="kpi-ico doc-header-icon"><Icon name={typeIcon} size={28} /></span>
              <div>
                <div className="row gap-8 wrap" style={{ marginBottom: 8 }}>
                  <span className="tag tag-type">{type?.name || 'Tipo no disponible'}</span>
                  <AreaTag areaId={doc.area} coordinationId={doc.coordination} />
                  <StateBadge state={doc.state} />
                </div>
                <h1 className="doc-header-title">{doc.name}</h1>
                <div className="row gap-12 mono text-sm muted doc-header-meta">
                  <span>{doc.documentNumber}</span><span style={{ color: 'var(--line)' }}>•</span>
                  <span>Versión {doc.version}</span><span style={{ color: 'var(--line)' }}>•</span>
                  <span className="row gap-6" title={`Última consulta: ${fmtDateTime(doc.lastViewedAt)}`}><Icon name="eye" size={14} />{doc.views} consultas</span>
                  <span style={{ color: 'var(--line)' }}>•</span>
                  <span className="row gap-6" title={`Última descarga: ${fmtDateTime(doc.lastDownloadedAt)}`}><Icon name="download" size={14} />{doc.downloads || 0} descargas</span>
                </div>
              </div>
            </div>
            <div className="row gap-8 doc-header-actions">
              <button className="btn btn-ghost" onClick={handleToggleFavorite} style={doc.fav ? { color: '#c98a13', borderColor: '#ecd9a8' } : null}><Icon name="star" size={16} />{doc.fav ? 'Favorito' : 'Marcar'}</button>
              <button className="btn btn-ghost" onClick={() => requestUpdate(doc)}><Icon name="refresh" size={16} />Solicitar actualización</button>
              {canEditDocument && <button className="btn btn-ghost" onClick={openEditModal}><Icon name="edit" size={16} />Editar datos</button>}
              {canCreateVersion && <button className="btn btn-ghost" onClick={openVersionModal}><Icon name="history" size={16} />Nueva versión</button>}
              {canDownload && <button className="btn btn-primary" onClick={handleDownload}><Icon name="download" size={16} />Descargar</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="seg mb-16 doc-detail-tabs">
            <button type="button" className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}><Icon name="sparkles" size={15} />Infografía</button>
            <button type="button" className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}><Icon name="eye" size={15} />Previsualización</button>
            <button type="button" className={tab === 'desc' ? 'active' : ''} onClick={() => setTab('desc')}><Icon name="doc" size={15} />Descripción</button>
          </div>
          {tab === 'info' ? (
            <DocumentInfographic
              doc={doc}
              area={area}
              coordination={coordination}
              type={type}
              owner={owner}
              canDownload={canDownload}
              onView={() => setTab('preview')}
              onDownload={handleDownload}
              onShare={handleShare}
              canReplace={canEditDocument && !savingInfographic}
              onReplace={replaceInfographic}
            />
          ) : tab === 'preview' ? (
            <div className="card" style={{ padding: 22 }}>
              <DocumentPreview
                docId={doc.id}
                doc={doc}
                height={420}
                onFullscreen
                onDownload={handleDownload}
                canDownload={canDownload}
                onError={(message, error) => showToast?.({
                  title: 'No se pudo abrir la previsualización',
                  message,
                  type: getErrorToastType(error),
                })}
              />
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
                      <span className="kpi-ico related-icon"><Icon name={typeById(r.type)?.icon || 'doc'} size={16} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="related-title">{r.name}</div>
                        <div className="mono text-xs muted">{r.documentNumber}</div>
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
              <div className="spec-row"><span className="k">Número documental</span><span className="v mono">{doc.documentNumber}</span></div>
              <div className="spec-row"><span className="k">Tipo documental</span><span className="v">{type?.name || 'Tipo no disponible'}</span></div>
              <div className="spec-row"><span className="k">Área responsable</span><span className="v">{area?.name || 'No disponible'}{coordination ? ` · ${coordination.name}` : Number(doc.area) === OPERATION_ACADEMIC_AREA_ID ? ' · General' : ''}</span></div>
              <div className="spec-row"><span className="k">Versión vigente</span><span className="v">v{doc.version}</span></div>
              <div className="spec-row"><span className="k">Estado</span><span className="v"><StateBadge state={doc.state} /></span></div>
              <div className="spec-row"><span className="k">Creación</span><span className="v">{fmtDate(doc.created)}</span></div>
              <div className="spec-row"><span className="k">Última actualización</span><span className="v">{fmtDate(doc.updated)}</span></div>
              <div className="spec-row"><span className="k">Vigencia</span><span className="v" style={doc.state === 'vencido' ? { color: 'var(--st-vencido-fg)' } : null}>{fmtDate(doc.vigencia)}</span></div>
            </div>
            <div className="row gap-10 mt-16 owner-row">
              <Avatar name={owner?.name} size={38} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{owner?.name || 'No disponible'}</div>
                <div className="text-xs muted">{owner?.role || ''}</div>
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
                    <span className="text-xs muted">{fmtDate(h.date)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 3 }}>{h.note}</div>
                  <div className="text-xs muted" style={{ marginTop: 2 }}>por {personById(h.by)?.name || h.by || 'Sistema'}</div>
                </div>
              ))}
              {(doc.versions || []).map((v) => (
                <div key={`file-${v.id}`} className="tl-item">
                  <span className="tl-dot muted"></span>
                  <div className="row between">
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>Archivo v{v.version}</span>
                    <span className="text-xs muted">{fmtDate(String(v.createdAt || '').slice(0, 10))}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 3 }}>{v.originalName || 'Archivo versionado'}</div>
                  {v.note && <div className="text-xs muted" style={{ marginTop: 2 }}>{v.note}</div>}
                  {canDownload && v.storedName && (
                    <button className="link text-xs mt-8" type="button" onClick={() => handleVersionDownload(v.id)}>Descargar esta versión</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Trazabilidad operativa</h3>
            <div className="timeline">
              {(doc.activity || []).length === 0 ? (
                <div className="text-sm muted">Sin eventos registrados.</div>
              ) : (doc.activity || []).map((event) => (
                <div key={event.id} className="tl-item">
                  <span className="tl-dot muted"></span>
                  <div className="row between">
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{event.action}</span>
                    <span className="text-xs muted">{fmtDate(event.date)}</span>
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 2 }}>por {event.whoName || 'Sistema'} · {event.eventType}</div>
                  {event.details?.version && <div className="text-xs muted" style={{ marginTop: 2 }}>Versión: v{event.details.version}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {versionModal && (
        <div className="modal-backdrop" onClick={() => !savingVersion && setVersionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Nueva versión</h3>
                <p className="muted text-sm">El documento quedará en borrador para iniciar nuevamente el flujo.</p>
              </div>
              <button className="tbar-icon-btn" type="button" onClick={() => setVersionModal(false)} disabled={savingVersion}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-row">
                  <label>Versión *</label>
                  <input className="input" value={versionForm.version} onChange={e => setVersionForm(f => ({ ...f, version: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label>Vigencia hasta</label>
                  <input className="input" type="date" value={versionForm.vigencia} onChange={e => setVersionForm(f => ({ ...f, vigencia: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <label>Nota de versión</label>
                <textarea className="input" value={versionForm.note} onChange={e => setVersionForm(f => ({ ...f, note: e.target.value }))} placeholder="Ej. Ajuste normativo, actualización de formato, corrección de contenido." />
              </div>
              <div className="form-row">
                <label>Descripción actualizada</label>
                <textarea className="input" value={versionForm.desc} onChange={e => setVersionForm(f => ({ ...f, desc: e.target.value }))} placeholder="Opcional. Si lo dejas vacío se conserva la descripción actual." />
              </div>
              <div className="version-assets-stack">
                <div className="form-row">
                  <label>Archivo de la nueva versión *</label>
                  <FileDropzone file={versionFile} onFile={setVersionFile} onError={message => showToast?.({ title: 'Archivo no válido', message, type: 'warning' })} />
                </div>
                <div className="form-row">
                  <div className="row between gap-8">
                    <label>Actualizar infografía</label>
                    <span className="tag">Opcional</span>
                  </div>
                  <InfographicDropzone file={versionInfographic} onFile={setVersionInfographic} onError={message => showToast?.({ title: 'Infografía no válida', message, type: 'warning' })} />
                  <span className="hint">
                    {doc.infographic?.available
                      ? `Si no seleccionas una imagen, se conservará ${doc.infographic.originalName || 'la infografía vigente'}.`
                      : 'Este documento no tiene infografía. Puedes agregarla junto con la nueva versión.'}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" type="button" onClick={() => setVersionModal(false)} disabled={savingVersion}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={submitVersion} disabled={savingVersion || !versionFile || !versionForm.version.trim()}>{savingVersion ? 'Creando...' : 'Crear versión'}<Icon name="arrowRight" size={15} /></button>
            </div>
          </div>
        </div>
      )}
      {editModal && (
        <div className="modal-backdrop" onClick={() => !savingEdit && setEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Editar datos del documento</h3>
                <p className="muted text-sm">{doc.documentNumber} · v{doc.version}</p>
              </div>
              <button className="tbar-icon-btn" type="button" onClick={() => setEditModal(false)} disabled={savingEdit}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Nombre *</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label>Responsable *</label>
                  <SelectField
                    value={editForm.owner}
                    onChange={value => setEditForm(f => ({ ...f, owner: value }))}
                    placeholder="Seleccionar..."
                    options={people.filter(p => !p.area || Number(p.area) === Number(doc.area)).map(p => ({ value: p.id, label: p.name }))}
                  />
                </div>
                <div className="form-row">
                  <label>Vigencia hasta</label>
                  <input className="input" type="date" value={editForm.vigencia} onChange={e => setEditForm(f => ({ ...f, vigencia: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <label>Descripción</label>
                <textarea className="input" value={editForm.desc} onChange={e => setEditForm(f => ({ ...f, desc: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>Palabras clave <span className="hint">separadas por coma</span></label>
                <input className="input" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" type="button" onClick={() => setEditModal(false)} disabled={savingEdit}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={submitEdit} disabled={savingEdit}>{savingEdit ? 'Guardando...' : 'Guardar cambios'}<Icon name="check" size={15} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
