import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Icon } from '../components';
import { getFile, getFileUrl, revokeFileUrl, formatFileSize, validateFile } from '../services/fileStore';
import { useCatalogs } from '../context/CatalogContext';
import { STATES, fmtDate } from '../utils/display';
import { getUserErrorMessage } from '../utils/errors';

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

export function DocumentPreview({ docId, doc, height = 420, onFullscreen, onDownload, onError, canDownload = true }) {
  const [fileRecord, setFileRecord] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [docxHtml, setDocxHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const urlRef = useRef(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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
    })().catch((loadError) => {
      if (cancelled) return;
      const message = getUserErrorMessage(loadError, 'No se pudo cargar la previsualización del documento.');
      setFileRecord(null);
      setError(message);
      setLoading(false);
      onErrorRef.current?.(message, loadError);
    });

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
            {canDownload && onDownload && (
              <button type="button" className="btn btn-primary btn-sm mt-16" onClick={onDownload}>
                <Icon name="download" size={14} />Descargar archivo
              </button>
            )}
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

export function FileDropzone({ file, onFile, error: externalError, onError }) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    const f = files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { setLocalError(err); onError?.(err); return; }
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

const MAX_INFOGRAPHIC_SIZE = 10 * 1024 * 1024;

export function validateInfographic(file) {
  if (!file) return 'Selecciona una infografia.';
  const extension = file.name.split('.').pop()?.toLowerCase();
  const acceptedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
  const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!acceptedExtensions.includes(extension) || !acceptedTypes.includes(file.type)) {
    return 'Formato no permitido. Usa PNG, JPG o WEBP.';
  }
  if (file.size > MAX_INFOGRAPHIC_SIZE) {
    return 'La infografia supera el limite de 10 MB.';
  }
  return null;
}

export function InfographicDropzone({ file, onFile, error: externalError, onError }) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFiles = (files) => {
    const selected = files?.[0];
    if (!selected) return;
    const validationError = validateInfographic(selected);
    if (validationError) {
      setLocalError(validationError);
      onError?.(validationError);
      return;
    }
    setLocalError(null);
    onFile(selected);
  };

  const error = externalError || localError;

  return (
    <div
      className={`infographic-dropzone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        handleFiles(event.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()}
      aria-label="Seleccionar infografia del documento"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(event) => handleFiles(event.target.files)}
      />
      {file ? (
        <div className="infographic-dropzone-selected" onClick={(event) => event.stopPropagation()}>
          <img src={previewUrl || ''} alt="Vista previa de la infografia seleccionada" />
          <div className="infographic-dropzone-copy">
            <span className="infographic-dropzone-status"><Icon name="check" size={13} />Infografia lista</span>
            <strong>{file.name}</strong>
            <small>{formatFileSize(file.size)} · Se mostrara en la ficha y en la biblioteca</small>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(event) => { event.stopPropagation(); onFile(null); }}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <span className="infographic-dropzone-icon"><Icon name="cards" size={25} /></span>
          <div>
            <strong>Agrega la infografia que acompana al documento</strong>
            <p>Arrastra una imagen o haz clic para seleccionarla.</p>
          </div>
          <span className="infographic-dropzone-format">PNG, JPG o WEBP · max. 10 MB</span>
        </>
      )}
      {error && <p className="file-dropzone-error">{error}</p>}
    </div>
  );
}

