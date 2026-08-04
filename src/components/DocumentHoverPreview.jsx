import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, StateBadge } from '../components';
import { useCatalogs } from '../context/CatalogContext';
import { api } from '../services/api';
import { fmtDate } from '../utils/display';

const PREVIEW_WIDTH = 430;
const PREVIEW_HEIGHT = 430;
const VIEWPORT_GAP = 14;

function placement(anchorRect) {
  if (!anchorRect || typeof window === 'undefined') return {};
  const roomOnRight = window.innerWidth - anchorRect.right;
  const left = roomOnRight >= PREVIEW_WIDTH + VIEWPORT_GAP
    ? anchorRect.right + VIEWPORT_GAP
    : Math.max(VIEWPORT_GAP, anchorRect.left - PREVIEW_WIDTH - VIEWPORT_GAP);
  const top = Math.min(
    Math.max(VIEWPORT_GAP, anchorRect.top),
    Math.max(VIEWPORT_GAP, window.innerHeight - PREVIEW_HEIGHT - VIEWPORT_GAP),
  );
  return { left, top, width: PREVIEW_WIDTH };
}

export function DocumentHoverPreview({ doc, anchorRect }) {
  const { areaById, coordinationById, typeById, personById } = useCatalogs();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const urlRef = useRef(null);
  const style = useMemo(() => placement(anchorRect), [anchorRect]);
  const area = areaById(doc?.area);
  const coordination = doc?.coordination ? coordinationById(doc.coordination) : null;
  const type = typeById(doc?.type);
  const owner = personById(doc?.owner);

  useEffect(() => {
    let cancelled = false;
    setImageUrl(null);
    setFailed(false);
    setLoading(Boolean(doc?.infographic?.available));
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (!doc?.infographic?.available) return undefined;

    api.getDocumentInfographic(doc.id)
      .then(record => {
        if (cancelled) return;
        if (!record?.blob) {
          setFailed(true);
          return;
        }
        const url = URL.createObjectURL(record.blob);
        urlRef.current = url;
        setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [doc?.id, doc?.infographic?.available, doc?.infographic?.uploadedAt]);

  if (!doc || !anchorRect || typeof document === 'undefined') return null;

  return createPortal(
    <aside
      className="library-hover-preview"
      style={{ ...style, '--hover-area-color': area?.color || 'var(--brand-700)' }}
      aria-label={`Vista rapida de ${doc.name}`}
      data-testid="document-hover-preview"
    >
      <div className="library-hover-media">
        {loading ? (
          <span className="library-hover-loading"><Icon name="clock" size={20} />Cargando infografia...</span>
        ) : imageUrl ? (
          <img src={imageUrl} alt={`Infografia de ${doc.name}`} />
        ) : (
          <div className="library-hover-empty">
            <Icon name={failed ? 'alert' : 'cards'} size={25} />
            <strong>{failed ? 'Infografia no disponible' : 'Sin infografia cargada'}</strong>
            <small>La informacion general sigue disponible.</small>
          </div>
        )}
        <span className="library-hover-eyebrow"><Icon name="sparkles" size={12} />Vista informativa</span>
      </div>
      <div className="library-hover-body">
        <div className="library-hover-title-row">
          <div>
            <span className="mono">{doc.documentNumber} · v{doc.version}</span>
            <h3>{doc.name}</h3>
          </div>
          <StateBadge state={doc.state} />
        </div>
        <p>{doc.desc || 'Documento institucional del Acervo.'}</p>
        <dl className="library-hover-facts">
          <div><dt><Icon name={type?.icon || 'doc'} size={13} />Tipo</dt><dd>{type?.name || 'No disponible'}</dd></div>
          <div><dt><Icon name="building" size={13} />Area</dt><dd>{coordination?.name || area?.name || 'No disponible'}</dd></div>
          <div><dt><Icon name="users" size={13} />Responsable</dt><dd>{owner?.name || 'No disponible'}</dd></div>
          <div><dt><Icon name="clock" size={13} />Actualizado</dt><dd>{fmtDate(doc.updated)}</dd></div>
        </dl>
        <div className="library-hover-hint"><span />Haz clic en el documento para abrir su ficha completa</div>
      </div>
    </aside>,
    document.body,
  );
}

export default DocumentHoverPreview;
