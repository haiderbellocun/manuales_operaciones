import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Icon, Modal, SelectField, useClickOutside } from './components';
import { useAuth } from './context/AuthContext';
import { useDocs } from './context/DocsContext';
import { useCatalogs } from './context/CatalogContext';
import { api } from './services/api';
import { OPERATION_ACADEMIC_AREA_ID } from './utils/areas';
import { AREA_VISUALS, OPERATION_VISUALS } from './utils/areaVisuals';
import { getErrorToastType, getUserErrorMessage } from './utils/errors';

const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const Library = lazy(() => import('./views/Library').then(m => ({ default: m.Library })));
const DocDetail = lazy(() => import('./views/Library').then(m => ({ default: m.DocDetail })));
const AnsModule = lazy(() => import('./views/Modules').then(m => ({ default: m.AnsModule })));
const AnsDetail = lazy(() => import('./views/Modules').then(m => ({ default: m.AnsDetail })));
const CargosModule = lazy(() => import('./views/Modules').then(m => ({ default: m.CargosModule })));
const CargoDetail = lazy(() => import('./views/Modules').then(m => ({ default: m.CargoDetail })));
const AppsModule = lazy(() => import('./views/Modules').then(m => ({ default: m.AppsModule })));
const AppDetail = lazy(() => import('./views/Modules').then(m => ({ default: m.AppDetail })));
const SearchView = lazy(() => import('./views/Gestion').then(m => ({ default: m.SearchView })));
const UploadFlow = lazy(() => import('./views/Gestion').then(m => ({ default: m.UploadFlow })));
const WorkflowView = lazy(() => import('./views/Gestion').then(m => ({ default: m.WorkflowView })));
const UsersView = lazy(() => import('./views/Gestion').then(m => ({ default: m.UsersView })));
const ReportsView = lazy(() => import('./views/Analytics').then(m => ({ default: m.ReportsView })));
const HelpView = lazy(() => import('./views/Gestion').then(m => ({ default: m.HelpView })));
const LoginView = lazy(() => import('./views/Login').then(m => ({ default: m.LoginView })));

function readBrowserLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state,
  };
}

function useBrowserNavigation() {
  const [location, setLocation] = useState(readBrowserLocation);

  useEffect(() => {
    const handlePopState = () => setLocation(readBrowserLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    const target = new URL(String(to), window.location.href);
    if (target.origin !== window.location.origin) {
      window.location.assign(target.href);
      return;
    }

    const nextUrl = `${target.pathname}${target.search}${target.hash}`;
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](options.state ?? null, '', nextUrl);
    setLocation(readBrowserLocation());
  }, []);

  return [location, navigate];
}

function softColor(hex, alpha = 0.12) {
  const clean = String(hex || '#0f5132').replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean, 16);
  if (Number.isNaN(n)) return `rgba(15,81,50,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function iconTone(color) {
  return {
    color,
    background: softColor(color, 0.12),
    borderColor: softColor(color, 0.38),
  };
}

function ProfileAvatar({ user, initials }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [user?.picture]);

  if (user?.picture && !imageFailed) {
    return (
      <img
        className="avatar avatar-image"
        src={user.picture}
        alt={`Foto de perfil de ${user.name || 'usuario'}`}
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <span className="avatar">{initials}</span>;
}

function buildLibraryLinks(areas = [], coordinations = []) {
  const links = [
    { label: 'Todos los documentos', desc: 'Repositorio completo', icon: 'library', view: 'library' },
    { label: 'Favoritos', desc: 'Tus documentos frecuentes', icon: 'star', view: 'library', params: { fav: true } },
    { section: 'Areas' },
  ];

  areas.forEach((area) => {
    const visual = AREA_VISUALS[Number(area.id)] || {};
    const areaColor = visual.color || area.color;
    links.push({
      label: area.name,
      desc: area.abbreviation,
      icon: 'building',
      image: visual.mascot,
      view: 'library',
      params: { area: area.id },
      color: areaColor,
    });

    if (area.requiresCoordination) {
      coordinations
        .filter(coordination => Number(coordination.areaId) === Number(area.id))
        .forEach((coordination) => {
          const coordinationVisual = OPERATION_VISUALS[Number(coordination.id)]
            || OPERATION_VISUALS.general;
          links.push({
            label: coordination.name,
            desc: `${area.abbreviation} / ${coordination.abbreviation}`,
            icon: 'building',
            image: coordinationVisual.mascot,
            view: 'library',
            params: { area: area.id, coordination: coordination.id },
            color: coordinationVisual.color,
            child: true,
            parentId: area.id,
          });
        });
    }
  });

  return links;
}

function buildNav(areas = [], coordinations = []) {
  return [
  { id: 'dashboard', label: 'Inicio', view: 'dashboard' },
  { id: 'biblioteca', label: 'Biblioteca', dd: buildLibraryLinks(areas, coordinations) },
  {
    id: 'modulos', label: 'Módulos', dd: [
      { label: 'Acuerdos de Nivel de Servicio', desc: 'Consulta y administra los ANS', icon: 'handshake', view: 'ans' },
      { label: 'Manuales de funciones y cargos', desc: 'Descriptores y funciones por cargo', icon: 'idcard', view: 'cargos' },
      { label: 'Manuales de aplicaciones', desc: 'Apps desarrolladas por el área', icon: 'app', view: 'apps' },
    ],
  },
  {
    id: 'gestion', label: 'Gestión', dd: [
      { label: 'Cargar documento', desc: 'Nuevo documento al repositorio', icon: 'upload', view: 'upload', permission: 'crear' },
      { label: 'Revisión y aprobación', desc: 'Flujo documental en curso', icon: 'flow', view: 'workflow' },
      { label: 'Usuarios y roles', desc: 'Permisos y accesos', icon: 'users', view: 'users', permission: 'administrar' },
    ],
  },
  { id: 'reportes', label: 'Analítica', view: 'reports' },
  ];
}

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

function canAccessView(view, { hasPermission, hasRole }) {
  switch (view) {
    case 'upload': return hasPermission('crear');
    case 'users': return hasPermission('administrar');
    case 'library':
    case 'detail':
    case 'history':
    case 'ans':
    case 'ansDetail':
    case 'cargos':
    case 'cargoDetail':
    case 'apps':
    case 'appDetail':
    case 'search':
    case 'workflow':
    case 'reports':
      return hasPermission('consultar');
    default:
      return true;
  }
}

function filterNav(nav, access) {
  return nav
    .map(item => {
      if (!item.dd) return canAccessView(item.view || item.id, access) ? item : null;
      const dd = item.dd.filter(link => {
        if (link.section) return true;
        if (link.permission && !access.hasPermission(link.permission)) return false;
        if (link.role && !access.hasRole(link.role)) return false;
        if (link.params?.area && [2, 3, 4, 8].includes(Number(access.user?.role))) {
          if (Number(access.user?.area) !== Number(link.params.area)) return false;
          if (
            link.params?.coordination
            && access.user?.coordination
            && Number(access.user?.area) !== OPERATION_ACADEMIC_AREA_ID
          ) {
            return Number(access.user.coordination) === Number(link.params.coordination);
          }
        }
        return canAccessView(link.view, access);
      });
      return dd.some(link => !link.section) ? { ...item, dd } : null;
    })
    .filter(Boolean);
}

function urlForView(view, params = {}) {
  const qs = new URLSearchParams();
  switch (view) {
    case 'dashboard': return '/';
    case 'library':
      if (params.area) qs.set('area', params.area);
      if (params.coordination) qs.set('coordination', params.coordination);
      if (params.type) qs.set('type', params.type);
      if (params.fav) qs.set('fav', 'true');
      return `/biblioteca${qs.toString() ? '?' + qs.toString() : ''}`;
    case 'detail': return `/documentos/${params.id}`;
    case 'history': return `/documentos/${params.id}/historial`;
    case 'ans': return '/modulos/ans';
    case 'ansDetail': return `/modulos/ans/${params.id}`;
    case 'cargos': return '/modulos/cargos';
    case 'cargoDetail': return `/modulos/cargos/${params.id}`;
    case 'apps': return '/modulos/aplicaciones';
    case 'appDetail': return `/modulos/aplicaciones/${params.id}`;
    case 'search':
      if (params.q) qs.set('q', params.q);
      return `/buscar${qs.toString() ? '?' + qs.toString() : ''}`;
    case 'upload': return '/gestion/cargar';
    case 'workflow': return '/gestion/flujo';
    case 'users': return '/gestion/usuarios';
    case 'reports': return '/reportes';
    case 'help': return '/ayuda';
    case 'login': return '/login';
    default: return '/';
  }
}

function routeFromLocation(location) {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const search = new URLSearchParams(location.search);

  if (path === '/') return { view: 'dashboard', params: {} };
  if (path === '/login') return { view: 'login', params: {} };
  if (path === '/biblioteca') {
    return {
      view: 'library',
      params: {
        area: search.get('area') ? Number(search.get('area')) : undefined,
        coordination: search.get('coordination') ? Number(search.get('coordination')) : undefined,
        type: search.get('type') ? Number(search.get('type')) : undefined,
        fav: search.get('fav') === 'true',
      },
    };
  }
  if (parts[0] === 'documentos' && parts[1]) {
    return { view: parts[2] === 'historial' ? 'history' : 'detail', params: { id: Number(parts[1]) } };
  }
  if (path === '/modulos/ans') return { view: 'ans', params: {} };
  if (parts[0] === 'modulos' && parts[1] === 'ans' && parts[2]) return { view: 'ansDetail', params: { id: parts[2] } };
  if (path === '/modulos/cargos') return { view: 'cargos', params: {} };
  if (parts[0] === 'modulos' && parts[1] === 'cargos' && parts[2]) return { view: 'cargoDetail', params: { id: parts[2] } };
  if (path === '/modulos/aplicaciones') return { view: 'apps', params: {} };
  if (parts[0] === 'modulos' && parts[1] === 'aplicaciones' && parts[2]) return { view: 'appDetail', params: { id: parts[2] } };
  if (path === '/buscar') return { view: 'search', params: { q: search.get('q') || undefined } };
  if (path === '/gestion/cargar') return { view: 'upload', params: {} };
  if (path === '/gestion/flujo') return { view: 'workflow', params: {} };
  if (path === '/gestion/usuarios') return { view: 'users', params: {} };
  if (path === '/reportes') return { view: 'reports', params: {} };
  if (path === '/ayuda') return { view: 'help', params: {} };
  return { view: 'dashboard', params: {} };
}

function NavDropdown({ item, onNav, active, onCloseMobile }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  useClickOutside(ref, () => setOpen(false));

  const handleNav = (view, params) => {
    onNav(view, params);
    setOpen(false);
    onCloseMobile?.();
  };

  const toggleGroup = (event, id) => {
    event.stopPropagation();
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
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
        <div className="dropdown">
          <div className="dd-grid">
            {item.dd.map((l, i) => {
              if (l.section) return <div key={i} className="dd-section-label">{l.section}</div>;
              if (l.child && !expandedGroups[l.parentId]) return null;
              const hasChildren = item.dd.some(child => child.child && Number(child.parentId) === Number(l.params?.area));
              return (
                <button key={i} type="button" className={'dd-link' + (l.child ? ' dd-link-child' : '')} onClick={() => handleNav(l.view, l.params)}>
                  <span className={'dd-ico' + (l.image ? ' dd-ico-mascot' : '')} style={l.color ? iconTone(l.color) : null}>
                    {l.image
                      ? <img src={l.image} alt="" aria-hidden="true" />
                      : <Icon name={l.icon} size={17} />}
                  </span>
                  <span className="dd-copy"><span className="dd-t">{l.label}</span><span className="dd-d">{l.desc}</span></span>
                  {hasChildren && (
                    <span
                      role="button"
                      tabIndex={0}
                      className={'dd-expand' + (expandedGroups[l.params.area] ? ' open' : '')}
                      onClick={(event) => toggleGroup(event, l.params.area)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') toggleGroup(event, l.params.area);
                      }}
                      aria-label={expandedGroups[l.params.area] ? 'Ocultar coordinaciones' : 'Mostrar coordinaciones'}
                    >
                      <Icon name="chevDown" size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({
  route,
  onNav,
  navItems,
  notifOpen,
  setNotifOpen,
  userOpen,
  setUserOpen,
  mobileOpen,
  setMobileOpen,
  authUser,
  initials,
  roleName,
  canManageUsers,
  notifications,
  unreadNotifications,
  onNotificationClick,
  onReadAllNotifications,
  onLogout,
}) {
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
        {navItems.map(item => (
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
            <Icon name="bell" size={19} />{unreadNotifications > 0 && <span className="tbar-dot"></span>}
          </button>
          {notifOpen && (
            <div className="dropdown notif-dropdown">
              <div className="notif-head row between">
                <span>Notificaciones</span>
                {unreadNotifications > 0 && <button type="button" className="link text-xs" onClick={onReadAllNotifications}>Marcar leidas</button>}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No tienes notificaciones.</div>
                ) : notifications.map((n) => {
                  const tone = n.type === 'update_request' ? 'amber' : 'brand';
                  const icon = n.type === 'update_request' ? 'alert' : n.type === 'file' ? 'upload' : 'clock';
                  return (
                    <button key={n.id} type="button" className={'dd-link notif-item' + (!n.read ? ' unread' : '')} onClick={() => onNotificationClick(n)}>
                      <span className="dd-ico" style={{ background: tone === 'amber' ? 'var(--st-revision-bg)' : 'var(--brand-50)', color: tone === 'amber' ? 'var(--st-revision-fg)' : 'var(--brand-700)' }}><Icon name={icon} size={16} /></span>
                      <span>
                        <span className="dd-t">{n.title}</span>
                        <span className="dd-d">{n.docNumber ? `${n.docNumber} - ` : ''}{n.message}</span>
                        {n.emailStatus === 'failed' && <span className="dd-d notif-mail-error">Correo no enviado: {n.emailError}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button type="button" className="tbar-icon-btn desktop-only" onClick={() => onNav('help')} aria-label="Ayuda"><Icon name="help" size={19} /></button>

        <div ref={userRef} className="user-wrap">
          <button type="button" className="user-chip" onClick={() => setUserOpen(o => !o)}>
            <ProfileAvatar user={authUser} initials={initials} />
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
              {canManageUsers && <button type="button" className="dd-link" onClick={() => onNav('users')}><span className="dd-ico"><Icon name="users" size={16} /></span><span><span className="dd-t">Usuarios y roles</span></span></button>}
              <button type="button" className="dd-link" onClick={() => onNav('reports')}><span className="dd-ico"><Icon name="report" size={16} /></span><span><span className="dd-t">Analítica documental</span></span></button>
              <button type="button" className="dd-link" onClick={onLogout}><span className="dd-ico" style={{ color: 'var(--st-vencido-fg)' }}><Icon name="logout" size={16} /></span><span><span className="dd-t">Cerrar sesión</span></span></button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ViewLoading() {
  return (
    <div className="page fade-in">
      <div className="card empty-state">
        <Icon name="clock" size={32} style={{ color: 'var(--brand-500)' }} />
        <p className="muted mt-16">Cargando vista...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, loading: authLoading, user, initials, roleName, logout, hasPermission, hasRole } = useAuth();
  const { docs, loading: docsLoading, toggleFav, refresh } = useDocs();
  const { areas, coordinations, personById } = useCatalogs();
  const [location, navigate] = useBrowserNavigation();
  const route = routeFromLocation(location);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [updateModal, setUpdateModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const mainRef = useRef(null);
  const toastTimerRef = useRef(null);
  const access = { hasPermission, hasRole, user };
  const navItems = filterNav(buildNav(areas, coordinations), access);

  const nav = (view, params = {}) => {
    navigate(urlForView(view, params));
    setNotifOpen(false);
    setUserOpen(false);
    setMobileOpen(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const requestUpdate = (doc) => setUpdateModal(doc);
  const showToast = useCallback((toastInput, type = 'success') => {
    const titles = {
      success: 'Acción completada',
      error: 'No se pudo completar',
      warning: 'Revisa la información',
      info: 'Procesando acción',
    };
    const nextToast = typeof toastInput === 'string'
      ? { message: toastInput, type }
      : { type: 'success', ...toastInput };
    nextToast.title = nextToast.title || titles[nextToast.type] || titles.info;
    setToast(nextToast);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const duration = nextToast.duration
      || (nextToast.type === 'error' || nextToast.type === 'warning' ? 6500 : 4200);
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const loadNotifications = async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }
    try {
      const result = await api.getNotifications();
      setNotifications(result.items || []);
      setUnreadNotifications(result.unread || 0);
    } catch {
      setNotifications([]);
      setUnreadNotifications(0);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      await api.markNotificationRead(notification.id);
      await loadNotifications();
      showToast({ title: 'Notificación actualizada', message: 'La notificación quedó marcada como leída.', type: 'success' });
    } catch (error) {
      showToast({
        title: 'No se pudo actualizar la notificación',
        message: getUserErrorMessage(error, 'No se pudo marcar la notificación como leída.'),
        type: getErrorToastType(error),
      });
    }
    setNotifOpen(false);
    if (notification.docId) nav('detail', { id: notification.docId });
  };

  const handleReadAllNotifications = async () => {
    try {
      await api.markAllNotificationsRead();
      await loadNotifications();
      showToast({ title: 'Notificaciones actualizadas', message: 'Todas las notificaciones quedaron marcadas como leídas.', type: 'success' });
    } catch (error) {
      showToast({
        title: 'No se pudieron actualizar las notificaciones',
        message: getUserErrorMessage(error, 'No se pudieron marcar las notificaciones como leídas.'),
        type: getErrorToastType(error),
      });
    }
  };

  const handleSubmitUpdate = async (doc, reason, detail) => {
    showToast({ title: 'Enviando solicitud', message: 'Estamos notificando al responsable del documento.', type: 'info', duration: 10000 });
    try {
      await api.requestUpdate(doc.id, { reason, detail });
      setUpdateModal(null);
      showToast({ title: 'Solicitud enviada', message: 'El responsable recibió la solicitud de actualización.', type: 'success' });
    } catch (error) {
      showToast({
        title: 'No se pudo enviar la solicitud',
        message: getUserErrorMessage(error, 'No se pudo enviar la solicitud de actualización.'),
        type: getErrorToastType(error),
      });
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

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setNotifOpen(false);
    setUserOpen(false);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isAuthenticated && route.view === 'login') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, route.view, navigate]);

  useEffect(() => {
    loadNotifications();
  }, [isAuthenticated]);

  useEffect(() => {
    if (notifOpen) loadNotifications();
  }, [notifOpen]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  if (authLoading) {
    return (
      <div className="app">
        <main className="main">
          <div className="page fade-in">
            <div className="card empty-state">
              <Icon name="clock" size={32} style={{ color: 'var(--brand-500)' }} />
              <p className="muted mt-16">Validando permisos...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<ViewLoading />}>
        <LoginView />
      </Suspense>
    );
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
    if (!canAccessView(v, access)) {
      return (
        <div className="page fade-in">
          <div className="card empty-state">
            <Icon name="shield" size={32} style={{ color: 'var(--ink-300)' }} />
            <p className="muted mt-16">No tienes permisos para acceder a esta seccion.</p>
            <button className="btn btn-primary mt-16" onClick={() => nav('dashboard')}>Volver al inicio</button>
          </div>
        </div>
      );
    }
    switch (v) {
      case 'dashboard': return <Dashboard nav={nav} userName={userName} />;
      case 'library': return <Library nav={nav} docs={docs} toggleFav={toggleFav} initParams={p} showToast={showToast} />;
      case 'detail': return <DocDetail nav={nav} docId={p.id} docs={docs} toggleFav={toggleFav} requestUpdate={requestUpdate} showToast={showToast} onVersionCreated={refresh} />;
      case 'ans': return <AnsModule nav={nav} />;
      case 'ansDetail': return <AnsDetail nav={nav} ansId={p.id} />;
      case 'cargos': return <CargosModule nav={nav} />;
      case 'cargoDetail': return <CargoDetail nav={nav} cargoId={p.id} />;
      case 'apps': return <AppsModule nav={nav} />;
      case 'appDetail': return <AppDetail nav={nav} appId={p.id} />;
      case 'search': return <SearchView nav={nav} docs={docs} initial={p.q} />;
      case 'upload': return <UploadFlow nav={nav} showToast={showToast} onUploaded={refresh} />;
      case 'workflow': return <WorkflowView nav={nav} docs={docs} showToast={showToast} />;
      case 'users': return <UsersView nav={nav} showToast={showToast} />;
      case 'reports': return <ReportsView nav={nav} docs={docs} showToast={showToast} />;
      case 'history': return <DocDetail nav={nav} docId={p.id} docs={docs} toggleFav={toggleFav} requestUpdate={requestUpdate} showToast={showToast} onVersionCreated={refresh} />;
      case 'help': return <HelpView nav={nav} />;
      default: return <Dashboard nav={nav} userName={userName} />;
    }
  };

  return (
    <div className="app">
      {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)}></div>}
      <TopBar
        route={route}
        onNav={nav}
        navItems={navItems}
        notifOpen={notifOpen}
        setNotifOpen={setNotifOpen}
        userOpen={userOpen}
        setUserOpen={setUserOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        authUser={user}
        initials={initials}
        roleName={roleName}
        canManageUsers={hasPermission('administrar')}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
        onNotificationClick={handleNotificationClick}
        onReadAllNotifications={handleReadAllNotifications}
        onLogout={handleLogout}
      />
      <main className="main" ref={mainRef}>
        <Suspense fallback={<ViewLoading />}>
          {render()}
        </Suspense>
      </main>

      {updateModal && (
        <UpdateRequestModal doc={updateModal} owner={personById(updateModal.owner)} onClose={() => setUpdateModal(null)} onSubmit={handleSubmitUpdate} />
      )}

      {toast && (
        <div
          className={'toast toast-' + (toast.type || 'success')}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          data-testid="app-toast"
        >
          <span className="toast-icon">
            <Icon name={toast.type === 'error' ? 'alert' : toast.type === 'warning' ? 'alert' : toast.type === 'info' ? 'help' : 'check'} size={17} />
          </span>
          <span className="toast-copy">
            <strong className="toast-title">{toast.title}</strong>
            <span className="toast-message">{toast.message}</span>
          </span>
          <button type="button" className="toast-close" onClick={() => setToast(null)} aria-label="Cerrar aviso">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function UpdateRequestModal({ doc, owner, onClose, onSubmit }) {
  const [reason, setReason] = useState('Información desactualizada');
  const [detail, setDetail] = useState('');
  return (
    <Modal title="Solicitar actualización" subtitle={doc.documentNumber + ' · ' + doc.name} onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => onSubmit(doc, reason, detail)}><Icon name="send" size={15} />Enviar solicitud</button></>}>
      <div className="form-row">
        <label>Motivo de la solicitud</label>
        <SelectField value={reason} onChange={setReason} options={[
          'Informaci\u00f3n desactualizada',
          'Cambio en el procedimiento',
          'Documento vencido',
          'Error o inconsistencia',
          'Otro',
        ]} />
      </div>
      <div className="form-row">
        <label>Detalle <span className="hint">— describe el cambio sugerido</span></label>
        <textarea className="input" value={detail} onChange={e => setDetail(e.target.value)} placeholder="Ej. El paso 4 ya no aplica desde la integración con ARL digital…"></textarea>
      </div>
      <div className="row gap-10" style={{ fontSize: 13, color: 'var(--ink-500)' }}>
        <Icon name="bell" size={15} />Se notificará a <strong style={{ color: 'var(--ink-700)' }}>{owner?.name || 'el responsable'}</strong>
      </div>
    </Modal>
  );
}
