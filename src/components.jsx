import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCatalogs } from './context/CatalogContext';
import { STATES } from './utils/display';
import { OPERATION_ACADEMIC_AREA_ID } from './utils/areas';

/* ---------- Íconos (line, 24x24, stroke) ---------- */
const ICONS = {
  dashboard: 'M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z',
  library: 'M4 19V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-2zM10 3h2v18h-2zM15.5 3.5l3.8 1 3.7 14.5-3.8 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 6l6 6-6 6',
  chevLeft: 'M15 6l-6 6 6 6',
  flow: 'M5 4h4v4H5zM15 4h4v4h-4zM10 16h4v4h-4zM7 8v4h10V8M12 12v4',
  briefcase: 'M3 8h18v12H3zM8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M3 13h18',
  idcard: 'M3 5h18v14H3zM7 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 17c0-2 1.5-3 3-3s3 1 3 3M14 9h4M14 13h4M14 16h2',
  app: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  handshake: 'M11 17l-2 2-3-3 5-5 2 2 3-3 4 4-3 3M3 11l3-3M21 11l-3-3',
  form: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16 8l-2 6-6 2 2-6z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  star: 'M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9z',
  download: 'M12 3v12M7 11l5 4 5-4M5 21h14',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  upload: 'M12 19V7M7 11l5-4 5 4M5 3h14',
  plus: 'M12 5v14M5 12h14',
  users: 'M16 19v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-2a3 3 0 0 0-2.3-2.9M16 4.2a3 3 0 0 1 0 5.6',
  report: 'M4 20V4M4 20h16M8 16V9M12 16V6M16 16v-4M20 16v-7',
  check: 'M5 12l5 5 9-11',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2',
  x: 'M6 6l12 12M18 6L6 18',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
  cards: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  hybrid: 'M3 5h18v5H3zM3 13h7v6H3zM13 13h8v6h-8z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 4v4h4M12 8v4l3 2',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.5',
  edit: 'M4 20h4l11-11-4-4L4 16zM13 5l4 4',
  archive: 'M3 7h18v4H3zM5 11h14v9H5zM9 15h6',
  alert: 'M12 3l10 17H2zM12 10v4M12 17h.01',
  file: 'M6 2h8l5 5v15H6zM14 2v5h5M9 13h6M9 17h6',
  folder: 'M3 6h6l2 2h10v11H3z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5M12 17h.01',
  menu: 'M3 6h18M3 12h18M3 18h18',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  building: 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M15 9h4a1 1 0 0 1 1 1v11M8 7h3M8 11h3M8 15h3',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  tag: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  sparkles: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8zM6 15l.6 1.6L8 17l-1.4.4L6 19l-.6-1.6L4 17l1.4-.4z',
  doc: 'M6 2h8l5 5v15H6zM14 2v5h5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  trend: 'M3 17l6-6 4 4 8-8M21 7v5h-5',
  pin: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
};

export function Icon({ name, size = 18, stroke = 2, style, className }) {
  const d = ICONS[name] || ICONS.doc;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

function SelectOptionMarker({ option, compact = false }) {
  if (option?.image) {
    return (
      <span className={`custom-select-marker image ${compact ? 'compact' : ''}`} aria-hidden="true">
        <img src={option.image} alt="" />
      </span>
    );
  }
  if (option?.icon) {
    return (
      <span
        className={`custom-select-marker icon ${compact ? 'compact' : ''}`}
        style={option.color ? { color: option.color } : undefined}
        aria-hidden="true"
      >
        <Icon name={option.icon} size={compact ? 13 : 15} />
      </span>
    );
  }
  if (option?.color) {
    return (
      <span
        className={`custom-select-marker color ${compact ? 'compact' : ''}`}
        style={{ '--select-option-color': option.color }}
        aria-hidden="true"
      />
    );
  }
  return null;
}

export function SelectField({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  disabled = false,
  className = '',
  ariaLabel,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const normalized = useMemo(() => options.map(option => (
    typeof option === 'string' ? { value: option, label: option } : option
  )), [options]);
  const selected = normalized.find(option => String(option.value) === String(value));
  const enabled = normalized.filter(option => !option.disabled);

  useEffect(() => {
    if (!open) return undefined;

    const placeMenu = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const maxHeight = Math.max(180, Math.min(320, Math.max(spaceBelow, spaceAbove)));
      const opensUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        top: opensUp ? undefined : rect.bottom + 6,
        bottom: opensUp ? window.innerHeight - rect.top + 6 : undefined,
        width: rect.width,
        maxHeight,
      });
    };

    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      setOpen(prev => !prev);
    }
    if (event.key === 'Escape') setOpen(false);
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const current = enabled.findIndex(option => String(option.value) === String(value));
      const dir = event.key === 'ArrowDown' ? 1 : -1;
      const next = enabled[(current + dir + enabled.length) % enabled.length] || enabled[0];
      if (next) onChange?.(next.value);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`input custom-select-trigger ${open ? 'open' : ''} ${className}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen(prev => !prev)}
        onKeyDown={onKeyDown}
      >
        {selected ? (
          <span className="custom-select-value">
            <SelectOptionMarker option={selected} compact />
            <span className="custom-select-label">{selected.label}</span>
          </span>
        ) : <span className="custom-select-placeholder">{placeholder}</span>}
        <Icon name="chevDown" size={16} className="custom-select-icon" />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="custom-select-menu" style={menuStyle} role="listbox">
          {normalized.map(option => {
            const active = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                className={'custom-select-option' + (active ? ' selected' : '')}
                disabled={option.disabled}
                role="option"
                aria-selected={active}
                onClick={() => !option.disabled && choose(option.value)}
              >
                <span className="custom-select-option-main">
                  <SelectOptionMarker option={option} />
                  <span className="custom-select-option-copy">
                    <span className="custom-select-option-label">{option.label}</span>
                    {option.description && (
                      <span className="custom-select-option-description">{option.description}</span>
                    )}
                  </span>
                </span>
                {active && <Icon name="check" size={15} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

export function StateBadge({ state }) {
  const s = STATES[state];
  if (!s) return null;
  return <span className={'badge badge-' + s.cls}><span className="b-dot"></span>{s.label}</span>;
}

export function AreaTag({ areaId, coordinationId, dot = true }) {
  const { areaById, coordinationById } = useCatalogs();
  const a = areaById(areaId);
  const c = coordinationId ? coordinationById(coordinationId) : null;
  if (!a) return null;
  const label = c
    ? `${a.abbreviation} · ${c.abbreviation}`
    : Number(areaId) === OPERATION_ACADEMIC_AREA_ID
      ? `${a.abbreviation} · General`
      : a.abbreviation;
  return (
    <span className="tag">
      {dot && <span className="area-dot" style={{ background: a.color }}></span>}
      {label}
    </span>
  );
}

export function TypeIcon({ typeId, size = 20 }) {
  const { typeById } = useCatalogs();
  const t = typeById(typeId);
  return <Icon name={t ? t.icon : 'doc'} size={size} />;
}

export function Avatar({ name, size = 32, color }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: color || '#cfe6d8', color: color ? '#fff' : 'var(--brand-700)' }}>
      {initials}
    </span>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 720 } : null} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.01em' }}>{title}</h3>
            {subtitle && <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'var(--ink-500)' }}>{subtitle}</p>}
          </div>
          <button className="tbar-icon-btn" style={{ color: 'var(--ink-400)' }} onClick={onClose} aria-label="Cerrar"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ImgPlaceholder({ label, height = 160 }) {
  return <div className="placeholder-img" style={{ height }}>{label}</div>;
}

export function KpiCard({ icon, value, label, tone = 'brand', trend }) {
  const tones = {
    brand: { bg: 'var(--brand-50)', fg: 'var(--brand-700)' },
    blue: { bg: 'var(--st-publicado-bg)', fg: 'var(--st-publicado-fg)' },
    amber: { bg: 'var(--st-revision-bg)', fg: 'var(--st-revision-fg)' },
    red: { bg: 'var(--st-vencido-bg)', fg: 'var(--st-vencido-fg)' },
    gray: { bg: 'var(--st-borrador-bg)', fg: 'var(--st-borrador-fg)' },
  };
  const tn = tones[tone] || tones.brand;
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-ico" style={{ background: tn.bg, color: tn.fg }}><Icon name={icon} size={19} /></span>
        {trend && <span className={'kpi-trend ' + (trend.dir === 'up' ? 'trend-up' : 'trend-down')}>
          <Icon name="trend" size={13} style={trend.dir === 'down' ? { transform: 'scaleY(-1)' } : null} />{trend.val}
        </span>}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export function DocCard({ doc, onOpen, onFav }) {
  const { areaById, coordinationById, typeById } = useCatalogs();
  const area = areaById(doc.area);
  const coordination = doc.coordination ? coordinationById(doc.coordination) : null;
  const type = typeById(doc.type);
  const areaColor = area?.color || 'var(--brand-700)';
  const typeIcon = type?.icon || 'doc';
  const areaLabel = coordination
    ? `${area?.abbreviation || 'N/D'} · ${coordination.abbreviation}`
    : (area?.abbreviation || 'N/D');
  return (
    <div className="doc-card" onClick={() => onOpen(doc.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(doc.id)}>
      <div className="doc-card-top" style={{ background: areaColor }}></div>
      <div className="doc-card-body">
        <div className="doc-card-head">
          <span className="doc-card-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}><Icon name={typeIcon} size={20} /></span>
          <button className={'doc-fav' + (doc.fav ? ' on' : '')} onClick={(e) => { e.stopPropagation(); onFav && onFav(doc.id); }} title="Favorito" aria-label="Marcar favorito">
            <Icon name="star" size={18} />
          </button>
        </div>
        <div>
          <div className="doc-card-title">{doc.name}</div>
          <div className="mono text-xs muted" style={{ marginTop: 5 }}>{doc.documentNumber} · v{doc.version}</div>
        </div>
        <div className="doc-card-meta">
          <span className="tag tag-type">{type?.name || 'Tipo no disponible'}</span>
        </div>
        <div className="doc-card-foot">
          <span className="row gap-6" style={{ fontSize: 12.5 }}>
            <span className="area-dot" style={{ background: areaColor }}></span>
            <span className="muted">{areaLabel}</span>
          </span>
          <StateBadge state={doc.state} />
        </div>
      </div>
    </div>
  );
}

export function useClickOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

export function FilterToggleButton({ open, count, onClick }) {
  return (
    <button type="button" className={'btn btn-ghost filter-toggle' + (open ? ' active' : '')} onClick={onClick}>
      <Icon name="filter" size={16} />
      Filtros
      {count > 0 && <span className="filter-count">{count}</span>}
    </button>
  );
}

