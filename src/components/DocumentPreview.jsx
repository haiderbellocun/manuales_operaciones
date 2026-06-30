import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Icon } from '../components';
import { getFile, getFileUrl, revokeFileUrl, formatFileSize, validateFile } from '../services/fileStore';
import { useCatalogs } from '../context/CatalogContext';
import { STATES, fmtDate } from '../utils/display';

function FallbackDocumentPreview({ doc, height = 420 }) {
  const { areaById, coordinationById, typeById, personById } = useCatalogs();
  const area = areaById(doc.area);
  const coordination = doc.coordination ? coordinationById(doc.coordination) : null;
  const type = typeById(doc.type);
  const owner = personById(doc.owner);
  return (
    <div className="fallback-doc-preview" style={{ minHeight: height }}>
      <div className="fallback-doc-header" style={{ borderTopColor: area?.color || 'var(--brand-700)' }}>
        <div className="fallback-doc-logo"><Icon name="building" size={20} /></div>
        <div>
          <div className="fallback-doc-org">Área de Operaciones — Documento institucional</div>
          <div className="fallback-doc-number">{doc.documentNumber} · v{doc.version}</div>
        </div>
      </div>
      <div className="fallback-doc-body">
        <span className="tag tag-type">{type?.name || 'Tipo no disponible'}</span>
        <h2 className="fallback-doc-title">{doc.name}</h2>
        <p className="fallback-doc-desc">{doc.desc}</p>
        <div className="fallback-doc-meta">
          <div><strong>Área:</strong> {area?.name || 'No disponible'}{coordination ? ` · ${coordination.name}` : ''}</div>
          <div><strong>Responsable:</strong> {owner?.name || 'No disponible'}</div>
          <div><strong>Estado:</strong> {STATES[doc.state]?.label}</div>
          <div><strong>Vigencia:</strong> {fmtDate(doc.vigencia)}</div>
        </div>
        {(doc.tags || []).length > 0 && (
          <div className="row gap-8 wrap mt-16">
            {doc.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
        )}
        <p className="fallback-doc-note text-xs muted mt-24">
          Vista simulada del repositorio. Carga un archivo PDF o DOCX para previsualización real.
        </p>
      </div>
    </div>
  );
}

export function DocumentPreview({ docId, doc, height = 420, onFullscreen, canDownload = true }) {
  const [fileRecord, setFileRecord] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [docxHtml, setDocxHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setDocxHtml(null);
      if (urlRef.current) { revokeFileUrl(urlRef.current); urlRef.current = null; setFileUrl(null); }
      if (!canDownload) {
        setFileRecord(null);
        setLoading(false);
        return;
      }

      const record = await getFile(docId);
      if (cancelled) return;
      setFileRecord(record);

      if (!record) {
        setLoading(false);
        return;
      }

      const url = getFileUrl(record);
      urlRef.current = url;
      setFileUrl(url);

      const isDocx = record.name.endsWith('.docx') || record.name.endsWith('.doc')
        || record.type.includes('wordprocessingml') || record.type === 'application/msword';

      if (isDocx && record.blob) {
        try {
          const mammoth = await import('mammoth');
          const arrayBuffer = await record.blob.arrayBuffer();
          const result = await mammoth.default.convertToHtml({ arrayBuffer });
          if (!cancelled) {
            setDocxHtml(DOMPurify.sanitize(result.value, {
              USE_PROFILES: { html: true },
              FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
              FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
            }));
          }
        } catch {
          if (!cancelled) setError('No se pudo renderizar el DOCX. Descarga el archivo para verlo.');
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) { revokeFileUrl(urlRef.current); urlRef.current = null; }
    };
  }, [docId, canDownload]);

  if (loading) {
    return (
      <div className="doc-preview-loading" style={{ height }}>
        <Icon name="clock" size={24} style={{ color: 'var(--brand-500)' }} />
        <span className="text-sm muted">Cargando previsualización…</span>
      </div>
    );
  }

  if (fileRecord && fileUrl) {
    const isPdf = fileRecord.name.endsWith('.pdf') || fileRecord.type === 'application/pdf';
    const isDocx = docxHtml !== null;

    return (
      <div className="doc-preview-real">
        <div className="doc-preview-file-bar">
          <Icon name="file" size={16} />
          <span className="text-sm" style={{ fontWeight: 600 }}>{fileRecord.name}</span>
          <span className="text-xs muted">{formatFileSize(fileRecord.size)}</span>
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--st-vencido-fg)', padding: '8px 0' }}>{error}</p>}
        {isPdf && (
          <iframe src={fileUrl} title={`Vista previa ${fileRecord.name}`} className="doc-preview-iframe" style={{ height }} />
        )}
        {isDocx && (
          <div className="doc-preview-docx" style={{ minHeight: height }} dangerouslySetInnerHTML={{ __html: docxHtml }} />
        )}
        {!isPdf && !isDocx && (
          <div className="doc-preview-unsupported" style={{ height }}>
            <Icon name="file" size={32} style={{ color: 'var(--ink-300)' }} />
            <p className="text-sm muted">Previsualización no disponible para este formato.</p>
            {canDownload && <a href={fileUrl} download={fileRecord.name} className="btn btn-primary btn-sm mt-16">Descargar archivo</a>}
          </div>
        )}
        {onFullscreen && isPdf && (
          <button type="button" className="btn btn-subtle btn-sm mt-12" onClick={() => window.open(fileUrl, '_blank')}>
            <Icon name="eye" size={14} />Abrir a pantalla completa
          </button>
        )}
      </div>
    );
  }

  return <FallbackDocumentPreview doc={doc} height={height} />;
}

export function FileDropzone({ file, onFile, error: externalError }) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    const f = files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    onFile(f);
  };

  const err = externalError || localError;

  return (
    <div
      className={'file-dropzone' + (dragOver ? ' drag-over' : '') + (file ? ' has-file' : '')}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.xlsx" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
      {file ? (
        <div className="file-dropzone-selected" onClick={(e) => e.stopPropagation()}>
          <Icon name="file" size={28} style={{ color: 'var(--brand-600)' }} />
          <div>
            <div className="file-dropzone-name">{file.name}</div>
            <div className="text-xs muted">{formatFileSize(file.size)}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onFile(null); }}>Quitar</button>
        </div>
      ) : (
        <>
          <Icon name="upload" size={28} style={{ color: 'var(--brand-500)' }} />
          <div className="upload-dropzone-title">Arrastra el archivo aquí o haz clic para seleccionar</div>
          <div className="text-xs muted">PDF, DOCX, XLSX · máx. 25 MB</div>
        </>
      )}
      {err && <p className="file-dropzone-error">{err}</p>}
    </div>
  );
}

