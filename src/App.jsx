import { useState, useEffect, useRef } from 'react';
import { DATA } from './data';
import { Icon, Modal, useClickOutside } from './components';
import { useAuth } from './context/AuthContext';
import { useDocs } from './context/DocsContext';
import { api } from './services/api';
import { Dashboard } from './views/Dashboard';
import { Library, DocDetail } from './views/Library';
import { AnsModule, AnsDetail, CargosModule, CargoDetail, AppsModule, AppDetail } from './views/Modules';
import { SearchView, UploadFlow, WorkflowView, UsersView, ReportsView, HelpView, LoginView } from './views/Gestion';

const NAV = [
  { id: 'dashboard', label: 'Inicio', view: 'dashboard' },
  {
    id: 'biblioteca', label: 'Biblioteca', dd: [
      { label: 'Todos los documentos', desc: 'Repositorio completo', icon: 'library', view: 'library' },
      { label: 'Favoritos', desc: 'Tus documentos frecuentes', icon: 'star', view: 'library', params: { fav: true } },
      { section: 'Áreas' },
      ...DATA.AREAS.map(a => ({ label: a.name, desc: a.code, icon: 'building', view: 'library', params: { area: a.id }, color: a.color })),
    ],
  },
  {
    id: 'modulos', label: 'Módulos', dd: [
      { label: 'Acuerdos de Nivel de Servicio', desc: 'Consulta y administra los ANS', icon: 'handshake', view: 'ans' },
      { label: 'Manuales de funciones y cargos', desc: 'Descriptores y funciones por cargo', icon: 'idcard', view: 'cargos' },
      { label: 'Manuales de aplicaciones', desc: 'Apps desarrolladas por el área', icon: 'app', view: 'apps' },
    ],
  },
  {
    id: 'gestion', label: 'Gestión', dd: [
      { label: 'Cargar documento', desc: 'Nuevo documento al repositorio', icon: 'upload', view: 'upload' },
      { label: 'Revisión y aprobación', desc: 'Flujo documental en curso', icon: 'flow', view: 'workflow' },
      { label: 'Usuarios y roles', desc: 'Permisos y accesos', icon: 'users', view: 'users' },
    ],
  },
  { id: 'reportes', label: 'Reportes', view: 'reports' },
];

const VIEW_TO_NAV = {
  dashboard: 'dashboard',
  library: 'biblioteca',
  detail: 'biblioteca',
  history: 'biblioteca',
  ans: 'modulos',
  ansDetail: 'modulos',
  cargos: 'modulos',
  cargoDetail: 'modulos',
  apps: 'modulos',
  appDetail: 'modulos',
  upload: 'gestion',
  workflow: 'gestion',
  users: 'gestion',
  reports: 'reportes',
  search: 'biblioteca',
  help: null,
};

function NavDropdown({ item, onNav, active, onCloseMobile }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useClickOutside(ref, () => setOpen(false));

  const handleNav = (view, params) => {
    onNav(view, params);
    setOpen(false);
    onCloseMobile?.();
  };

  if (!item.dd) {
    return (
      <button type="button" className={'nav-item' + (active ? ' active' : '')} onClick={() => handleNav(item.view || item.id)}>
        <span className="lbl">{item.label}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="nav-dropdown-wrap">
      <button type="button" className={'nav-item' + (active ? ' active' : '') + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}>
        <span className="lbl">{item.label}</span>
        <Icon name="chevDown" size={14} className="chev" />
      </button>
      {open && (
        <div className="dropdown" onClick={() => setOpen(false)}>
          <div className="dd-grid">
            {item.dd.map((l, i) => l.section ? (
              <div key={i} className="dd-section-label">{l.section}</div>
            ) : (
              <button key={i} type="button" className="dd-link" onClick={() => handleNav(l.view, l.params)}>
                <span className="dd-ico" style={l.color ? { background: l.color, color: '#fff' } : null}><Icon name={l.icon} size={17} /></span>
                <span><span className="dd-t">{l.label}</span><span className="dd-d">{l.desc}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ route, onNav, notifOpen, setNotifOpen, userOpen, setUserOpen, mobileOpen, setMobileOpen, authUser, initials, roleName, onLogout }) {
  const notifRef = useRef(null);
  const userRef = useRef(null);
  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(userRef, () => setUserOpen(false));
  const activeTop = VIEW_TO_NAV[route.view];

  return (
    <header className="topbar">
      <button type="button" className="tbar-icon-btn mobile-menu-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Menú">
        <Icon name={mobileOpen ? 'x' : 'menu'} size={22} />
      </button>

      <div className="brand" onClick={() => { onNav('dashboard'); setMobileOpen(false); }} role="button" tabIndex={0}>
        <span className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-2zM10 3h2v18h-2zM15.5 3.5l3.8 1 3.7 14.5-3.8 1z" /></svg>
        </span>
        <span><span className="brand-name">Acervo</span><span className="brand-sub">Operaciones</span></span>
      </div>

      <nav className={'nav' + (mobileOpen ? ' mobile-open' : '')}>
        {NAV.map(item => (
          <NavDropdown key={item.id} item={item} onNav={onNav} active={activeTop === item.id} onCloseMobile={() => setMobileOpen(false)} />
        ))}
        <div className="mobile-nav-extras">
          <button type="button" className="dd-link" onClick={() => { onNav('search'); setMobileOpen(false); }}>
            <span className="dd-ico"><Icon name="search" size={17} /></span>
            <span><span className="dd-t">Buscador inteligente</span><span className="dd-d">Ctrl+K</span></span>
          </button>
          <button type="button" className="dd-link" onClick={() => { onNav('help'); setMobileOpen(false); }}>
            <span className="dd-ico"><Icon name="help" size={17} /></span>
            <span><span className="dd-t">Ayuda</span></span>
          </button>
        </div>
      </nav>

      <div className="topbar-right">
        <div className="tbar-search" onClick={() => onNav('search')} role="button" tabIndex={0}>
          <Icon name="search" size={16} />
          <input placeholder="Buscar documentos, cargos, ANS…" readOnly />
          <span className="tbar-kbd">⌘K</span>
        </div>

        <div ref={notifRef} className="notif-wrap">
          <button type="button" className="tbar-icon-btn" onClick={() => setNotifOpen(o => !o)} aria-label="Notificaciones">
            <Icon name="bell" size={19} /><span className="tbar-dot"></span>
          </button>
          {notifOpen && (
            <div className="dropdown notif-dropdown">
              <div className="notif-head">Notificaciones</div>
              <div className="notif-list">
                {[
                  { i: 'alert', t: '2 documentos vencieron', d: 'PRA-MF-002 y OAP-IN-008 requieren actualización', tone: 'red' },
                  { i: 'clock', t: 'Aprobación pendiente', d: 'Política de equivalencias (HOM-PO-001) espera tu visto bueno', tone: 'amber' },
                  { i: 'check', t: 'Diana publicó v5.1', d: 'Homologación de asignaturas (HOM-PR-001)', tone: 'brand' },
                ].map((n, i) => (
                  <div key={i} className="dd-link notif-item">
                    <span className="dd-ico" style={{ background: n.tone === 'red' ? 'var(--st-vencido-bg)' : n.tone === 'amber' ? 'var(--st-revision-bg)' : 'var(--brand-50)', color: n.tone === 'red' ? 'var(--st-vencido-fg)' : n.tone === 'amber' ? 'var(--st-revision-fg)' : 'var(--brand-700)' }}><Icon name={n.i} size={16} /></span>
                    <span><span className="dd-t">{n.t}</span><span className="dd-d">{n.d}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button type="button" className="tbar-icon-btn desktop-only" onClick={() => onNav('help')} aria-label="Ayuda"><Icon name="help" size={19} /></button>

        <div ref={userRef} className="user-wrap">
          <button type="button" className="user-chip" onClick={() => setUserOpen(o => !o)}>
            <span className="avatar">{initials}</span>
            <span className="user-meta desktop-only">
              <span className="user-name">{authUser?.name?.split(' ').slice(0, 2).join(' ') || 'Usuario'}</span>
              <span className="user-role">{roleName}</span>
            </span>
            <Icon name="chevDown" size={14} className="desktop-only" style={{ opacity: .6 }} />
          </button>
          {userOpen && (
            <div className="dropdown user-dropdown">
              <div className="user-dropdown-head">
                <div style={{ fontWeight: 700, fontSize: 14 }}>{authUser?.name}</div>
                <div className="text-xs muted">{authUser?.email}</div>
                <span className="badge badge-aprobado user-badge"><Icon name="shield" size={12} />{roleName}</span>
              </div>
              <button type="button" className="dd-link" onClick={() => onNav('users')}><span className="dd-ico"><Icon name="users" size={16} /></span><span><span className="dd-t">Usuarios y roles</span></span></button>
              <button type="button" className="dd-link" onClick={() => onNav('reports')}><span className="dd-ico"><Icon name="report" size={16} /></span><span><span className="dd-t">Reportes e indicadores</span></span></button>
              <button type="button" className="dd-link" onClick={onLogout}><span className="dd-ico" style={{ color: 'var(--st-vencido-fg)' }}><Icon name="logout" size={16} /></span><span><span className="dd-t">Cerrar sesión</span></span></button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const { isAuthenticated, user, initials, roleName, logout } = useAuth();
  const { docs, loading: docsLoading, toggleFav, refresh } = useDocs();
  const [route, setRoute] = useState({ view: 'dashboard', params: {} });
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [updateModal, setUpdateModal] = useState(null);
  const [toast, setToast] = useState(null);
  const mainRef = useRef(null);

  const nav = (view, params = {}) => {
    setRoute({ view, params });
    setNotifOpen(false);
    setUserOpen(false);
    setMobileOpen(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  };

  const handleLogout = () => {
    logout();
    setRoute({ view: 'dashboard', params: {} });
  };

  const requestUpdate = (doc) => setUpdateModal(doc);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const handleSubmitUpdate = async (doc, reason, detail) => {
    try {
      await api.requestUpdate(doc.id, { reason, detail });
      setUpdateModal(null);
      showToast('Solicitud de actualización enviada al responsable');
    } catch {
      showToast('No se pudo enviar la solicitud. Intenta de nuevo.');
    }
  };

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isAuthenticated) nav('search');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isAuthenticated]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const render = () => {
    if (docsLoading && docs.length === 0) {
      return (
        <div className="page fade-in">
          <div className="card empty-state">
            <Icon name="clock" size={32} style={{ color: 'var(--brand-500)' }} />
            <p className="muted mt-16">Cargando repositorio documental…</p>
          </div>
        </div>
      );
    }

    const v = route.view;
    const p = route.params;
    const userName = user?.name?.split(' ')[0] || 'Usuario';
    switch (v) {
      case 'dashboard': return <Dashboard nav={nav} docs={docs} userName={userName} />;
      case 'library': return <Library nav={nav} docs={docs} toggleFav={toggleFav} initParams={p} />;
      case 'detail': return <DocDetail nav={nav} docId={p.id} docs={docs} toggleFav={toggleFav} requestUpdate={requestUpdate} />;
      case 'ans': return <AnsModule nav={nav} />;
      case 'ansDetail': return <AnsDetail nav={nav} ansId={p.id} />;
      case 'cargos': return <CargosModule nav={nav} />;
      case 'cargoDetail': return <CargoDetail nav={nav} cargoId={p.id} />;
      case 'apps': return <AppsModule nav={nav} />;
      case 'appDetail': return <AppDetail nav={nav} appId={p.id} />;
      case 'search': return <SearchView nav={nav} docs={docs} initial={p.q} />;
      case 'upload': return <UploadFlow nav={nav} showToast={showToast} onUploaded={refresh} />;
      case 'workflow': return <WorkflowView nav={nav} docs={docs} />;
      case 'users': return <UsersView nav={nav} />;
      case 'reports': return <ReportsView nav={nav} docs={docs} />;
      case 'history': return <DocDetail nav={nav} docId={p.id} docs={docs} toggleFav={toggleFav} requestUpdate={requestUpdate} />;
      case 'help': return <HelpView nav={nav} />;
      default: return <Dashboard nav={nav} docs={docs} userName={userName} />;
    }
  };

  return (
    <div className="app">
      {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)}></div>}
      <TopBar route={route} onNav={nav} notifOpen={notifOpen} setNotifOpen={setNotifOpen} userOpen={userOpen} setUserOpen={setUserOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} authUser={user} initials={initials} roleName={roleName} onLogout={handleLogout} />
      <main className="main" ref={mainRef}>{render()}</main>

      {updateModal && (
        <UpdateRequestModal doc={updateModal} onClose={() => setUpdateModal(null)} onSubmit={handleSubmitUpdate} />
      )}

      {toast && (
        <div className="toast">
          <Icon name="check" size={17} style={{ color: '#7fdca6' }} />{toast}
        </div>
      )}
    </div>
  );
}

function UpdateRequestModal({ doc, onClose, onSubmit }) {
  const [reason, setReason] = useState('Información desactualizada');
  const [detail, setDetail] = useState('');
  return (
    <Modal title="Solicitar actualización" subtitle={doc.code + ' · ' + doc.name} onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => onSubmit(doc, reason, detail)}><Icon name="send" size={15} />Enviar solicitud</button></>}>
      <div className="form-row">
        <label>Motivo de la solicitud</label>
        <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
          <option>Información desactualizada</option>
          <option>Cambio en el procedimiento</option>
          <option>Documento vencido</option>
          <option>Error o inconsistencia</option>
          <option>Otro</option>
        </select>
      </div>
      <div className="form-row">
        <label>Detalle <span className="hint">— describe el cambio sugerido</span></label>
        <textarea className="input" value={detail} onChange={e => setDetail(e.target.value)} placeholder="Ej. El paso 4 ya no aplica desde la integración con ARL digital…"></textarea>
      </div>
      <div className="row gap-10" style={{ fontSize: 13, color: 'var(--ink-500)' }}>
        <Icon name="bell" size={15} />Se notificará a <strong style={{ color: 'var(--ink-700)' }}>{DATA.personById(doc.owner).name}</strong>
      </div>
    </Modal>
  );
}
