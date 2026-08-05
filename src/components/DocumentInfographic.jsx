import { useEffect, useRef, useState } from 'react';
import { Avatar, Icon, StateBadge } from '../components';
import { api } from '../services/api';
import { fmtDate, fmtDateTime } from '../utils/display';

function informativeValue(value, fallback = 'Contenido pendiente') {
  const normalized = String(value || '').trim();
  return { value: normalized || fallback, pending: !normalized };
}

function publicationDate(doc) {
  if (doc.publishedAt) return doc.publishedAt;
  const event = (doc.activity || []).find(item => (
    item.details?.status === 'published'
    || item.details?.action === 'publish'
  ));
  return event?.createdAt || null;
}

/** Categoría provisional: tipo documental hasta existir catálogo institucional. */
function resolveCategory(doc, infographic, type) {
  return informativeValue(infographic.category || doc.category || type?.name);
}

/**
 * Proceso provisional hasta catálogo institucional:
 * coordinación del área si aplica; si no, el área responsable.
 */
function resolveProcess(doc, infographic, area, coordination) {
  return informativeValue(
    infographic.process || doc.process || coordination?.name || area?.name,
    'Pendiente de catálogo institucional',
  );
}

function InfoFact({ icon, label, value, pending = false, mono = false }) {
  return (
    <div className={`doc-info-fact${pending ? ' is-pending' : ''}`}>
      <span className="doc-info-fact-icon"><Icon name={icon} size={16} /></span>
      <span className="doc-info-fact-copy">
        <small>{label}</small>
        <strong className={mono ? 'mono' : undefined}>{value}</strong>
      </span>
    </div>
  );
}

function QuickMetric({ icon, value, label, tone = 'green' }) {
  return (
    <div className={`doc-info-metric doc-info-metric-${tone}`}>
      <span><Icon name={icon} size={16} /></span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function DocumentInfographicVisual({ doc }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(Boolean(doc.infographic?.available));
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setLoading(Boolean(doc.infographic?.available));
    setImageUrl(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (!doc.infographic?.available) return undefined;

    api.getDocumentInfographic(doc.id)
      .then(record => {
        if (cancelled) return;
        if (!record?.blob) {
          setFailed(true);
          return;
        }
        const nextUrl = URL.createObjectURL(record.blob);
        objectUrlRef.current = nextUrl;
        setImageUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [doc.id, doc.infographic?.available, doc.infographic?.uploadedAt]);

  useEffect(() => {
    if (!expanded) return undefined;
    const close = event => event.key === 'Escape' && setExpanded(false);
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [expanded]);

  if (loading) {
    return (
      <div className="doc-info-visual doc-info-image-state">
        <span className="doc-info-image-loader"><Icon name="clock" size={22} />Cargando infografia...</span>
      </div>
    );
  }

  if (!imageUrl || failed) {
    return (
      <div className="doc-info-visual doc-info-image-state is-empty">
        <span className="doc-info-empty-icon"><Icon name="cards" size={26} /></span>
        <strong>{failed ? 'No se pudo cargar la infografia' : 'Documento sin infografia'}</strong>
        <p>Los documentos existentes pueden completar este recurso cuando vuelvan a borrador.</p>
      </div>
    );
  }

  return (
    <>
      <div className="doc-info-visual doc-info-image-visual">
        <button type="button" onClick={() => setExpanded(true)} aria-label="Ampliar infografia">
          <img src={imageUrl} alt={`Infografia de ${doc.name}`} />
          <span><Icon name="eye" size={14} />Ampliar infografia</span>
        </button>
      </div>
      {expanded && (
        <div className="doc-infographic-lightbox" role="dialog" aria-modal="true" aria-label={`Infografia de ${doc.name}`} onClick={() => setExpanded(false)}>
          <button type="button" className="doc-infographic-lightbox-close" onClick={() => setExpanded(false)} aria-label="Cerrar">
            <Icon name="x" size={20} />
          </button>
          <img src={imageUrl} alt={`Infografia ampliada de ${doc.name}`} onClick={event => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}

export function DocumentInfographic({
  doc,
  area,
  coordination,
  type,
  owner,
  canDownload,
  onView,
  onDownload,
  onShare,
  canReplace = false,
  onReplace,
}) {
  const infographic = doc.infographic || {};
  const category = resolveCategory(doc, infographic, type);
  const process = resolveProcess(doc, infographic, area, coordination);
  const objective = informativeValue(infographic.objective || doc.objective, 'Objetivo pendiente de contenido');
  const description = informativeValue(infographic.description || doc.desc, 'Descripción pendiente de contenido');
  const publishedAt = infographic.publicationDate || publicationDate(doc);
  const areaLabel = coordination
    ? `${area?.name || 'Área no disponible'} · ${coordination.name}`
    : area?.name || 'Área no disponible';
  const keywords = (infographic.keywords || doc.tags || []).filter(Boolean);

  return (
    <section
      className="doc-info-sheet"
      style={{ '--doc-info-color': area?.color || 'var(--brand-700)' }}
      aria-label={`Infografia documental de ${doc.name}`}
    >
      <header className="doc-info-hero">
        <div className="doc-info-hero-copy">
          <div className="doc-info-kicker"><Icon name="sparkles" size={14} />Infografía documental</div>
          <div className="doc-info-badges">
            <span className="tag tag-type"><Icon name={type?.icon || 'doc'} size={12} />{type?.name || 'Tipo no disponible'}</span>
            <StateBadge state={doc.state} />
          </div>
          <h2>{doc.name}</h2>
          <p>{description.value}</p>
          <div className="doc-info-actions">
            <button type="button" className="btn btn-primary" onClick={onView}>
              <Icon name="eye" size={16} />Ver documento
            </button>
            {canDownload && (
              <button type="button" className="btn btn-ghost" onClick={onDownload}>
                <Icon name="download" size={16} />Descargar
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onShare}>
              <Icon name="link" size={16} />Compartir
            </button>
            {canReplace && (
              <label className="btn btn-ghost doc-info-replace-button">
                <Icon name="refresh" size={16} />Cambiar infografía
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) onReplace?.(file);
                    event.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <DocumentInfographicVisual doc={doc} />
      </header>

      <div className="doc-info-metrics" aria-label="Indicadores rápidos">
        <QuickMetric icon="eye" value={Number(doc.views || 0).toLocaleString('es-CO')} label="Consultas" />
        <QuickMetric icon="download" value={Number(doc.downloads || 0).toLocaleString('es-CO')} label="Descargas" tone="blue" />
        <QuickMetric icon="history" value={`v${doc.version}`} label="Versión vigente" tone="purple" />
        <QuickMetric icon="clock" value={fmtDate(doc.updated)} label="Última actualización" tone="amber" />
      </div>

      <div className="doc-info-content-grid">
        <div className="doc-info-main-copy">
          <section className="doc-info-section">
            <span className="doc-info-section-label"><Icon name="compass" size={15} />Objetivo del documento</span>
            <p className={objective.pending ? 'is-pending' : undefined}>{objective.value}</p>
          </section>
          <section className="doc-info-section">
            <span className="doc-info-section-label"><Icon name="list" size={15} />Descripción general</span>
            <p className={description.pending ? 'is-pending' : undefined}>{description.value}</p>
          </section>
          <section className="doc-info-section doc-info-keywords">
            <span className="doc-info-section-label"><Icon name="tag" size={15} />Palabras clave</span>
            <div>
              {keywords.length
                ? keywords.map(keyword => <span className="tag" key={keyword}>{keyword}</span>)
                : <span className="doc-info-pending-chip">Pendientes de contenido</span>}
            </div>
          </section>
        </div>

        <aside className="doc-info-facts" aria-label="Datos principales del documento">
          <div className="doc-info-facts-head">
            <span><Icon name="form" size={17} /></span>
            <div><strong>Datos del documento</strong><small>Información de identificación y control</small></div>
          </div>
          <InfoFact icon="doc" label="Número documental" value={doc.documentNumber} mono />
          <InfoFact icon="library" label="Tipo documental" value={type?.name || 'Tipo no disponible'} />
          <InfoFact icon="folder" label="Categoría" value={category.value} pending={category.pending} />
          <InfoFact icon="flow" label="Proceso" value={process.value} pending={process.pending} />
          <InfoFact icon="building" label="Área responsable" value={areaLabel} />
          <InfoFact icon="send" label="Fecha de publicación" value={publishedAt ? fmtDateTime(publishedAt) : 'Registro no disponible'} pending={!publishedAt} />
          <InfoFact icon="refresh" label="Fecha de actualización" value={fmtDate(doc.updated)} />
          <div className="doc-info-owner">
            <Avatar name={owner?.name} size={38} />
            <span><small>Responsable</small><strong>{owner?.name || 'No disponible'}</strong><em>{owner?.role || ''}</em></span>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default DocumentInfographic;
