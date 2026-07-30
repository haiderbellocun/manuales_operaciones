import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components';
import { useAuth } from '../context/AuthContext';
import { useCatalogs } from '../context/CatalogContext';
import { api } from '../services/api';
import {
  OPERATION_ACADEMIC_AREA_ID,
  OPERATION_ACADEMIC_FULL_ROLE_ID,
} from '../utils/areas';
import { storage } from '../utils/storage';
import { AREA_VISUALS, OPERATION_VISUALS } from '../utils/areaVisuals';

const LAYERS = [
  {
    id: 'process',
    label: 'Ruta documental',
    shortLabel: 'Proceso',
    icon: 'flow',
    description: 'Cómo encontrar, crear y mantener un documento.',
  },
  {
    id: 'areas',
    label: 'Mapa de áreas',
    shortLabel: 'Áreas',
    icon: 'building',
    description: 'Dónde vive la documentación dentro de la organización.',
  },
  {
    id: 'roles',
    label: 'Roles y responsabilidades',
    shortLabel: 'Roles',
    icon: 'users',
    description: 'Quién interviene en cada momento del proceso.',
  },
];

const AREA_REFERENCE = [
  { id: 1, name: 'Coordinación de Operación Académica', abbreviation: 'COA', color: '#29366f', requiresCoordination: true },
  { id: 2, name: 'Coordinación de Fábrica y Desarrollo', abbreviation: 'CFD', color: '#43b8bf' },
  { id: 3, name: 'Especializaciones', abbreviation: 'ESP', color: '#970b12' },
  { id: 4, name: 'Coordinación B2B', abbreviation: 'B2B', color: '#c5102e' },
  { id: 5, name: 'Coordinación de Servicio', abbreviation: 'CSE', color: '#c51a78' },
  { id: 6, name: 'Coordinación Pruebas Saber', abbreviation: 'CPS', color: '#70b52b' },
  { id: 7, name: 'Coordinación de Proyección Social', abbreviation: 'CPSO', color: '#08743e' },
  { id: 8, name: 'Coordinación de Desarrollo Profesional', abbreviation: 'CDP', color: '#9f559b' },
];

const COORDINATION_REFERENCE = [
  { id: 1, areaId: 1, name: 'Coordinación Escuela Bellas Artes', abbreviation: 'EBA', sortOrder: 1 },
  { id: 2, areaId: 1, name: 'Coordinación Escuela Transversales', abbreviation: 'ETR', sortOrder: 2 },
  { id: 3, areaId: 1, name: 'Coordinación Escuela Transformación Empresarial', abbreviation: 'ETE', sortOrder: 3 },
  { id: 4, areaId: 1, name: 'Coordinación Escuela Transformación de Negocios', abbreviation: 'ETN', sortOrder: 4 },
  { id: 5, areaId: 1, name: 'Coordinación Escuela Transformación de Ingenierías', abbreviation: 'ETI', sortOrder: 5 },
];

const PERMISSION_LABELS = {
  crear: 'Crear documentos',
  editar: 'Editar y versionar',
  aprobar: 'Aprobar',
  publicar: 'Publicar',
  archivar: 'Archivar',
  consultar: 'Consultar',
  descargar: 'Descargar',
  administrar: 'Administrar',
};

const ROLE_REFERENCE = [
  {
    id: 1,
    name: 'Administrador general',
    icon: 'settings',
    summary: 'Administra la plataforma y supervisa el flujo sin reemplazar al revisor ni al aprobador.',
    scope: 'Todas las áreas y todos los documentos.',
    permissions: ['crear', 'editar', 'archivar', 'consultar', 'descargar', 'administrar'],
    stages: ['buscar', 'crear', 'actualizar', 'administrar'],
  },
  {
    id: 2,
    name: 'Líder de área',
    icon: 'building',
    summary: 'Gestiona los documentos de su área y puede revisar, aprobar y publicar cuando queda asignado en el flujo.',
    scope: 'Área asignada y tareas expresamente asignadas; en COA la escritura continúa limitada a la escuela asignada.',
    permissions: ['crear', 'editar', 'aprobar', 'publicar', 'archivar', 'consultar', 'descargar'],
    stages: ['buscar', 'crear', 'revisar', 'aprobar', 'publicar', 'actualizar'],
  },
  {
    id: 3,
    name: 'Editor documental',
    icon: 'edit',
    summary: 'Crea, actualiza y envía documentos al flujo.',
    scope: 'Área y escuela asignadas para creación y edición.',
    permissions: ['crear', 'editar', 'consultar', 'descargar'],
    stages: ['buscar', 'crear', 'actualizar'],
  },
  {
    id: 4,
    name: 'Revisor',
    icon: 'eye',
    summary: 'Revisa el contenido asignado, lo marca como aprobado o lo devuelve para ajustes.',
    scope: 'Documentos visibles y tareas expresamente asignadas en el flujo.',
    permissions: ['consultar', 'descargar'],
    stages: ['buscar', 'revisar'],
  },
  {
    id: 5,
    name: 'Aprobador',
    icon: 'check',
    summary: 'Aprueba y publica cuando recibe una asignación del flujo.',
    scope: 'Tareas asignadas; el rol por sí solo no habilita acciones sobre cualquier documento.',
    permissions: ['aprobar', 'publicar', 'consultar', 'descargar'],
    stages: ['buscar', 'aprobar', 'publicar'],
  },
  {
    id: 6,
    name: 'Usuario consultor',
    icon: 'search',
    summary: 'Encuentra, consulta y descarga documentación publicada.',
    scope: 'Documentos publicados disponibles para consulta.',
    permissions: ['consultar', 'descargar'],
    stages: ['buscar'],
  },
  {
    id: 7,
    name: 'Auditor / lector institucional',
    icon: 'shield',
    summary: 'Consulta documentos y trazabilidad sin modificar ni descargar.',
    scope: 'Lectura institucional y seguimiento de trazabilidad.',
    permissions: ['consultar'],
    stages: ['buscar'],
  },
  {
    id: 8,
    name: 'Coordinador de Operación Académica',
    icon: 'grid',
    summary: 'Gestiona Operación Académica y puede revisar, aprobar y publicar cuando queda asignado en el flujo.',
    scope: 'Toda Operación Académica, incluidas sus cinco escuelas y el alcance general; las decisiones requieren asignación expresa.',
    permissions: ['crear', 'editar', 'aprobar', 'publicar', 'archivar', 'consultar', 'descargar'],
    stages: ['buscar', 'crear', 'revisar', 'aprobar', 'publicar', 'actualizar'],
  },
];

const PROCESS_ROUTES = [
  {
    id: 'consultation',
    label: 'Ruta de consulta',
    eyebrow: 'Encontrar y utilizar',
    color: '#15663f',
    stations: [
      {
        id: 'search',
        stage: 'buscar',
        title: 'Buscar',
        icon: 'search',
        description: 'Encuentra por nombre, código o palabra clave.',
        detail: 'El buscador recorre los documentos disponibles dentro de tu alcance de consulta.',
        actors: 'Todos los roles con permiso de consulta.',
        location: 'Buscador inteligente',
        permission: 'consultar',
        actionLabel: 'Ir al buscador',
        view: 'search',
      },
      {
        id: 'library',
        stage: 'buscar',
        title: 'Explorar',
        icon: 'library',
        description: 'Filtra la biblioteca por área, escuela, tipo o estado.',
        detail: 'La biblioteca organiza el acervo y permite combinar filtros para llegar al documento correcto.',
        actors: 'Todos los roles con permiso de consulta.',
        location: 'Biblioteca documental',
        permission: 'consultar',
        actionLabel: 'Abrir biblioteca',
        view: 'library',
      },
      {
        id: 'record',
        stage: 'buscar',
        title: 'Abrir ficha',
        icon: 'doc',
        description: 'Revisa metadatos, archivo, versión e historial.',
        detail: 'Cada documento tiene una ficha única. Primero búscalo o encuéntralo en la biblioteca y luego abre su detalle.',
        actors: 'Usuarios con acceso al documento.',
        location: 'Ficha documental',
        permission: 'consultar',
        actionLabel: 'Encontrar documento',
        view: 'search',
      },
      {
        id: 'consult',
        stage: 'buscar',
        title: 'Consultar',
        icon: 'eye',
        description: 'Visualiza el contenido y su trazabilidad.',
        detail: 'Desde la ficha puedes previsualizar el archivo, entender su alcance y consultar versiones anteriores.',
        actors: 'Usuarios con permiso de consulta.',
        location: 'Ficha documental',
        permission: 'consultar',
        actionLabel: 'Explorar documentos',
        view: 'library',
      },
      {
        id: 'use',
        stage: 'buscar',
        title: 'Usar',
        icon: 'download',
        description: 'Descarga, guarda como favorito o solicita actualización.',
        detail: 'Las acciones finales dependen de tus permisos. Solicitar actualización se realiza desde la ficha del documento.',
        actors: 'Según permisos efectivos y alcance documental.',
        location: 'Acciones de la ficha',
        permission: 'consultar',
        actionLabel: 'Ir a la biblioteca',
        view: 'library',
      },
    ],
  },
  {
    id: 'management',
    label: 'Ruta de gestión',
    eyebrow: 'Crear y mantener',
    color: '#2563eb',
    stations: [
      {
        id: 'upload',
        stage: 'crear',
        title: 'Cargar',
        icon: 'upload',
        description: 'Registra el documento y su archivo inicial.',
        detail: 'La creación define tipo, área, alcance, responsable, archivo y participantes del flujo. Puede guardarse como borrador o enviarse directamente a revisión.',
        actors: 'Administrador, líder, editor y coordinador COA según alcance.',
        location: 'Gestión · Cargar documento',
        permission: 'crear',
        actionLabel: 'Cargar documento',
        view: 'upload',
      },
      {
        id: 'review',
        stage: 'revisar',
        title: 'Revisar',
        icon: 'eye',
        description: 'Valida el contenido y lo marca como aprobado o lo devuelve.',
        detail: 'Solo el usuario asignado y habilitado como revisor puede tomar esta decisión. Puede ser Revisor, Líder de área o Coordinador de Operación Académica. El estado Aprobado todavía no hace visible el documento para todos.',
        actors: 'Revisor, Líder de área o Coordinador de Operación Académica asignado.',
        location: 'Gestión · Revisión y aprobación',
        permission: 'consultar',
        actionLabel: 'Ver flujo',
        view: 'workflow',
      },
      {
        id: 'approve',
        stage: 'aprobar',
        title: 'Aprobar para publicar',
        icon: 'check',
        description: 'Toma la decisión final sobre el documento aprobado.',
        detail: 'Solo el usuario asignado y habilitado como aprobador puede confirmar la publicación. Puede ser Aprobador, Líder de área o Coordinador de Operación Académica.',
        actors: 'Aprobador, Líder de área o Coordinador de Operación Académica asignado.',
        location: 'Gestión · Revisión y aprobación',
        permission: 'aprobar',
        actionLabel: 'Ver aprobaciones',
        view: 'workflow',
      },
      {
        id: 'publish',
        stage: 'publicar',
        title: 'Publicar',
        icon: 'send',
        description: 'Deja disponible la versión para todos los usuarios.',
        detail: 'El documento solo se vuelve visible para consulta general después de que el aprobador asignado confirma “Aprobar y publicar”.',
        actors: 'Resultado de la decisión del usuario asignado como aprobador.',
        location: 'Gestión · Revisión y aprobación',
        permission: 'publicar',
        actionLabel: 'Ver flujo',
        view: 'workflow',
      },
      {
        id: 'update',
        stage: 'actualizar',
        title: 'Actualizar',
        icon: 'history',
        description: 'Crea una nueva versión sin perder trazabilidad.',
        detail: 'Busca el documento, abre su ficha y utiliza “Nueva versión”. No existe una pantalla independiente de actualización.',
        actors: 'Usuarios con permiso de edición dentro de su alcance.',
        location: 'Ficha documental',
        permission: 'editar',
        actionLabel: 'Buscar documento',
        view: 'search',
      },
    ],
  },
];

const ROLE_STAGES = [
  { id: 'buscar', label: 'Consultar', icon: 'search' },
  { id: 'crear', label: 'Crear', icon: 'upload' },
  { id: 'revisar', label: 'Revisar', icon: 'eye' },
  { id: 'aprobar', label: 'Aprobar', icon: 'check' },
  { id: 'publicar', label: 'Publicar', icon: 'send' },
  { id: 'actualizar', label: 'Actualizar', icon: 'history' },
  { id: 'administrar', label: 'Administrar', icon: 'settings' },
];

const TOUR_STEPS = [
  {
    layer: 'process',
    target: '.map-home-hero',
    icon: 'compass',
    title: 'Bienvenido al Mapa vivo de Acervo',
    description: 'Este inicio te enseña cómo funciona la aplicación y te lleva directamente al lugar que necesitas.',
  },
  {
    layer: 'process',
    target: '.map-home-quick-section',
    icon: 'search',
    title: 'Empieza por lo que necesitas hacer',
    description: 'Busca un documento, explora la biblioteca o sigue las estaciones del ciclo documental.',
  },
  {
    layer: 'areas',
    areaLevel: 'areas',
    target: '.area-map-canvas',
    icon: 'building',
    title: 'Conoce dónde vive la información',
    description: 'El mapa de áreas presenta la estructura institucional y abre cada biblioteca dentro de tu alcance.',
  },
  {
    layer: 'areas',
    areaLevel: 'operation',
    target: '.area-map-canvas',
    icon: 'grid',
    title: 'Operación Académica tiene una lógica especial',
    description: 'COA contiene cinco escuelas y documentos generales compartidos. Tu escuela limita la escritura, no la consulta.',
  },
  {
    layer: 'roles',
    target: '.role-map-canvas',
    icon: 'users',
    title: 'Comprende quién participa',
    description: 'Explora cada rol y revisa cuáles son tus permisos efectivos dentro de Acervo.',
  },
  {
    layer: 'process',
    target: '.process-detail-card',
    icon: 'shield',
    title: 'Las acciones respetan tus permisos',
    description: 'El mapa orienta, pero nunca amplía el acceso: el área, la escuela, la asignación y los permisos siguen vigentes.',
  },
  {
    layer: 'process',
    target: '.map-home-guide',
    icon: 'sparkles',
    title: 'Ya puedes recorrer Acervo',
    description: 'Puedes volver a abrir esta guía en cualquier momento desde el botón “Ver recorrido”.',
  },
];

const FILE_DESTINATIONS = [
  {
    id: 'library',
    title: 'Biblioteca documental',
    description: 'Procedimientos, formatos, instructivos, guías, políticas y demás documentos institucionales.',
    icon: 'library',
    view: 'library',
  },
  {
    id: 'favorites',
    title: 'Mis favoritos',
    description: 'Los documentos que marcaste para volver a consultarlos rápidamente.',
    icon: 'star',
    view: 'library',
    params: { fav: true },
  },
  {
    id: 'ans',
    title: 'Acuerdos de Nivel de Servicio',
    description: 'Consulta las fichas estructuradas y documentos relacionados con los ANS.',
    icon: 'handshake',
    view: 'ans',
  },
  {
    id: 'roles',
    title: 'Manuales de funciones y cargos',
    description: 'Encuentra descriptores, responsabilidades y funciones asociadas a los cargos.',
    icon: 'idcard',
    view: 'cargos',
  },
  {
    id: 'apps',
    title: 'Manuales de aplicaciones',
    description: 'Accede a la documentación de las aplicaciones desarrolladas por el área.',
    icon: 'app',
    view: 'apps',
  },
];

function mergeCatalog(reference, catalog, areaKey = 'id') {
  return reference.map((fallback) => {
    const current = catalog.find(item => Number(item[areaKey]) === Number(fallback[areaKey]));
    return { ...fallback, ...(current || {}) };
  });
}

function QuickAction({ action, nav }) {
  return (
    <button
      type="button"
      className="map-home-quick-action"
      onClick={() => nav(action.view, action.params)}
    >
      <span className="map-home-quick-icon"><Icon name={action.icon} size={17} /></span>
      <span>
        <strong>{action.label}</strong>
        <small>{action.description}</small>
      </span>
      <Icon name="arrowRight" size={15} className="map-home-quick-arrow" />
    </button>
  );
}

function ProcessStation({ station, index, routeColor, selected, allowed, onSelect }) {
  return (
    <li
      className="process-station-wrap"
      style={{ '--station-delay': `${index * 70}ms`, '--route-color': routeColor }}
    >
      <button
        type="button"
        className={`process-station ${selected ? 'selected' : ''} ${allowed ? '' : 'restricted'}`}
        onClick={() => onSelect(station.id)}
        aria-pressed={selected}
        aria-label={`${station.title}. ${station.description}${allowed ? '' : '. Acción restringida por permisos'}`}
      >
        <span className="process-station-index mono">{String(index + 1).padStart(2, '0')}</span>
        <span className="process-station-icon"><Icon name={station.icon} size={18} /></span>
        <span className="process-station-copy">
          <strong>{station.title}</strong>
          <small>{station.description}</small>
        </span>
        {!allowed ? (
          <span className="process-station-lock" title="Acción restringida">
            <Icon name="lock" size={12} />
            <span>Sin acceso</span>
          </span>
        ) : (
          <span className="process-station-go" aria-hidden="true">
            <Icon name="chevRight" size={14} />
          </span>
        )}
      </button>
    </li>
  );
}

function TourDialog({ step, onBack, onNext, onSkip }) {
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  const primaryRef = useRef(null);
  const dialogRef = useRef(null);
  const [spotlight, setSpotlight] = useState(null);
  const [dialogPosition, setDialogPosition] = useState(null);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [step]);

  useEffect(() => {
    let frameId;
    let targetElement;
    let attempts = 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setSpotlight(null);
    setDialogPosition(null);

    const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

    const placeDialog = (targetRect) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const dialogWidth = dialogRef.current?.offsetWidth || Math.min(410, viewportWidth - 40);
      const dialogHeight = dialogRef.current?.offsetHeight || 340;
      const margin = 20;
      const gap = 18;
      const spaces = [
        { direction: 'right', space: viewportWidth - targetRect.right - margin, needed: dialogWidth + gap },
        { direction: 'left', space: targetRect.left - margin, needed: dialogWidth + gap },
        { direction: 'below', space: viewportHeight - targetRect.bottom - margin, needed: dialogHeight + gap },
        { direction: 'above', space: targetRect.top - margin, needed: dialogHeight + gap },
      ];
      const fitting = spaces
        .filter(option => option.space >= option.needed)
        .sort((a, b) => (b.space - b.needed) - (a.space - a.needed));
      const placement = fitting[0] || spaces.sort((a, b) => b.space - a.space)[0];
      let top;
      let left;

      if (placement.direction === 'right') {
        top = clamp(targetRect.top, margin, viewportHeight - dialogHeight - margin);
        left = targetRect.right + gap;
      } else if (placement.direction === 'left') {
        top = clamp(targetRect.top, margin, viewportHeight - dialogHeight - margin);
        left = targetRect.left - dialogWidth - gap;
      } else if (placement.direction === 'above') {
        top = targetRect.top - dialogHeight - gap;
        left = clamp(targetRect.left, margin, viewportWidth - dialogWidth - margin);
      } else {
        top = targetRect.bottom + gap;
        left = clamp(targetRect.left, margin, viewportWidth - dialogWidth - margin);
      }

      setDialogPosition({
        direction: placement.direction,
        top: clamp(top, margin, viewportHeight - dialogHeight - margin),
        left: clamp(left, margin, viewportWidth - dialogWidth - margin),
      });
    };

    const measureTarget = (shouldScroll = false) => {
      targetElement = document.querySelector(current.target);
      if (!targetElement) {
        attempts += 1;
        if (attempts < 24) frameId = window.requestAnimationFrame(() => measureTarget(shouldScroll));
        return;
      }

      targetElement.setAttribute('data-map-tour-target', 'true');
      const initialRect = targetElement.getBoundingClientRect();
      if (
        shouldScroll
        && (initialRect.top < 84 || initialRect.bottom > window.innerHeight - 36)
      ) {
        targetElement.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: window.innerWidth <= 700 ? 'start' : 'center',
          inline: 'nearest',
        });
      }

      const rect = targetElement.getBoundingClientRect();
      const padding = 9;
      const margin = 10;
      const top = Math.max(margin, rect.top - padding);
      const left = Math.max(margin, rect.left - padding);
      const right = Math.min(window.innerWidth - margin, rect.right + padding);
      const bottom = Math.min(window.innerHeight - margin, rect.bottom + padding);
      const nextSpotlight = {
        top,
        left,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
      setSpotlight(nextSpotlight);
      placeDialog(nextSpotlight);
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => measureTarget(false));
    };

    frameId = window.requestAnimationFrame(() => measureTarget(true));
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
      targetElement?.removeAttribute('data-map-tour-target');
    };
  }, [current.target, step]);

  const keepFocusInside = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={`map-tour-backdrop ${spotlight ? 'has-spotlight' : ''}`}>
      {spotlight ? (
        <>
          <span className="map-tour-shade map-tour-shade-top" style={{ height: spotlight.top }}></span>
          <span className="map-tour-shade map-tour-shade-bottom" style={{ top: spotlight.bottom }}></span>
          <span
            className="map-tour-shade map-tour-shade-left"
            style={{ top: spotlight.top, width: spotlight.left, height: spotlight.height }}
          ></span>
          <span
            className="map-tour-shade map-tour-shade-right"
            style={{ top: spotlight.top, left: spotlight.right, height: spotlight.height }}
          ></span>
          <span
            className="map-tour-spotlight"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
            aria-hidden="true"
          ></span>
        </>
      ) : (
        <span className="map-tour-shade map-tour-shade-full"></span>
      )}
      <section
        ref={dialogRef}
        className={`map-tour-dialog map-tour-dialog-${dialogPosition?.direction || 'below'}`}
        style={dialogPosition
          ? { top: dialogPosition.top, left: dialogPosition.left, right: 'auto', bottom: 'auto' }
          : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-tour-title"
        aria-describedby="map-tour-description"
        onKeyDown={keepFocusInside}
      >
        <div className="map-tour-progress" aria-label={`Paso ${step + 1} de ${TOUR_STEPS.length}`}>
          {TOUR_STEPS.map((item, index) => (
            <span key={`${item.title}-${index}`} className={index <= step ? 'active' : ''}></span>
          ))}
        </div>
        <div key={step} className="map-tour-content">
          <div className="map-tour-step-label mono">PASO {step + 1} / {TOUR_STEPS.length}</div>
          <span className="map-tour-icon"><Icon name={current.icon} size={24} /></span>
          <h2 id="map-tour-title">{current.title}</h2>
          <p id="map-tour-description">{current.description}</p>
          <div className="map-tour-focus-note">
            <Icon name="eye" size={14} /> Observa la sección iluminada en pantalla.
          </div>
        </div>
        <div className="map-tour-actions">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            {last ? 'Cerrar' : 'Omitir recorrido'}
          </button>
          <div className="row gap-8">
            {step > 0 && <button type="button" className="btn btn-ghost" onClick={onBack}>Atrás</button>}
            {!last && (
              <button ref={primaryRef} type="button" className="btn btn-primary" onClick={onNext}>
                Continuar <Icon name="arrowRight" size={15} />
              </button>
            )}
            {last && (
              <button ref={primaryRef} type="button" className="btn btn-primary" onClick={onSkip}>
                Empezar <Icon name="check" size={15} />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function Dashboard({ nav, userName = 'Usuario' }) {
  const { user, roleName, hasPermission } = useAuth();
  const { areas, coordinations } = useCatalogs();
  const canConsult = hasPermission('consultar');
  const [activeLayer, setActiveLayer] = useState('areas');
  const [areaMapLevel, setAreaMapLevel] = useState('areas');
  const [selectedStationId, setSelectedStationId] = useState('search');
  const [selectedAreaId, setSelectedAreaId] = useState(() => Number(user?.area) || OPERATION_ACADEMIC_AREA_ID);
  const [selectedOperationNodeId, setSelectedOperationNodeId] = useState(
    () => user?.coordination ? `school-${user.coordination}` : 'general',
  );
  const [selectedRoleId, setSelectedRoleId] = useState(() => Number(user?.role) || 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [tourOpen, setTourOpen] = useState(() => !storage.hasSeenHomeTour());
  const [tourStep, setTourStep] = useState(0);
  const [mapPreview, setMapPreview] = useState(null);
  const [mapCounts, setMapCounts] = useState({ byArea: {}, byCoordination: {}, operationGeneral: 0 });
  const [mapCountsStatus, setMapCountsStatus] = useState('loading');
  const areaMapCanvasRef = useRef(null);
  const areaMapGridRef = useRef(null);

  const areaCatalog = useMemo(
    () => mergeCatalog(AREA_REFERENCE, areas).map((area) => ({
      ...area,
      ...(AREA_VISUALS[Number(area.id)] || {}),
    })),
    [areas],
  );
  const coordinationCatalog = useMemo(
    () => mergeCatalog(COORDINATION_REFERENCE, coordinations),
    [coordinations],
  );
  const selectedRole = ROLE_REFERENCE.find(role => Number(role.id) === Number(selectedRoleId)) || ROLE_REFERENCE[0];
  const currentRole = ROLE_REFERENCE.find(role => Number(role.id) === Number(user?.role));
  const currentArea = areaCatalog.find(area => Number(area.id) === Number(user?.area));
  const currentCoordination = coordinationCatalog.find(
    coordination => Number(coordination.id) === Number(user?.coordination),
  );
  const canAdmin = hasPermission('administrar');
  const currentRoleId = Number(user?.role);
  const areaScopedRole = !canAdmin && [2, 3, 4, OPERATION_ACADEMIC_FULL_ROLE_ID].includes(currentRoleId);
  const canOpenArea = area => !areaScopedRole || Number(user?.area) === Number(area.id);
  const operationCoordinations = coordinationCatalog
    .filter(coordination => Number(coordination.areaId) === OPERATION_ACADEMIC_AREA_ID)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  const operationArea = areaCatalog.find(area => Number(area.id) === OPERATION_ACADEMIC_AREA_ID);
  const operationMapNodes = [
    {
      id: 'general',
      name: 'General de Operación Académica',
      abbreviation: 'GENERAL',
      color: OPERATION_VISUALS.general.color,
      mascot: OPERATION_VISUALS.general.mascot,
      kind: 'general',
    },
    ...operationCoordinations.map((coordination) => {
      const visual = OPERATION_VISUALS[Number(coordination.id)] || OPERATION_VISUALS.general;
      return {
        id: `school-${coordination.id}`,
        name: coordination.name.replace(/^Coordinaci[oó]n\s+/i, ''),
        abbreviation: coordination.abbreviation,
        color: visual.color,
        contrast: visual.contrast,
        mascot: visual.mascot,
        kind: 'school',
        coordinationId: coordination.id,
      };
    }),
  ];
  const operationMapAccessible = Boolean(operationArea && canOpenArea(operationArea));
  const selectedStation = PROCESS_ROUTES
    .flatMap(route => route.stations)
    .find(station => station.id === selectedStationId) || PROCESS_ROUTES[0].stations[0];
  const selectedStationAllowed = !selectedStation.permission || hasPermission(selectedStation.permission);
  const effectivePermissions = Object.entries(user?.perms || {})
    .filter(([, enabled]) => enabled)
    .map(([permission]) => permission);
  const selectedRoleIsCurrent = Number(selectedRole.id) === currentRoleId;
  const rolePermissions = selectedRoleIsCurrent ? effectivePermissions : selectedRole.permissions;
  const firstName = String(user?.name || userName || 'Usuario').trim().split(/\s+/)[0];

  const quickActions = [
    { id: 'search', label: 'Buscar documento', description: 'Por nombre, código o palabra clave', icon: 'search', view: 'search', show: hasPermission('consultar') },
    { id: 'library', label: 'Explorar biblioteca', description: 'Por área, escuela, tipo o estado', icon: 'library', view: 'library', show: hasPermission('consultar') },
    { id: 'workflow', label: 'Ver mis tareas', description: 'Revisión y aprobación en curso', icon: 'flow', view: 'workflow', show: hasPermission('consultar') },
    { id: 'upload', label: 'Cargar documento', description: 'Registrar y enviar al flujo', icon: 'upload', view: 'upload', show: hasPermission('crear') },
    { id: 'reports', label: 'Consultar reportes', description: 'Resumen del acervo disponible', icon: 'report', view: 'reports', show: hasPermission('consultar') },
    { id: 'users', label: 'Usuarios y roles', description: 'Accesos y permisos', icon: 'users', view: 'users', show: hasPermission('administrar') },
  ].filter(action => action.show).slice(0, 6);

  useEffect(() => {
    let cancelled = false;

    if (!canConsult) {
      setMapCountsStatus('unavailable');
      return undefined;
    }

    setMapCountsStatus('loading');
    api.getMapDocumentCounts()
      .then((summary) => {
        if (cancelled) return;
        const byArea = Object.fromEntries(
          (summary?.byArea || []).map(row => [Number(row.id), Number(row.value) || 0]),
        );
        const byCoordination = Object.fromEntries(
          (summary?.byCoordination || []).map(row => [Number(row.id), Number(row.value) || 0]),
        );
        setMapCounts({
          byArea,
          byCoordination,
          operationGeneral: Number(summary?.operationGeneral) || 0,
        });
        setMapCountsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setMapCountsStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [canConsult, user?.id]);

  useEffect(() => {
    setMapPreview(null);
  }, [activeLayer, areaMapLevel]);

  useEffect(() => {
    if (activeLayer !== 'areas') return undefined;
    const grid = areaMapGridRef.current;
    if (!grid) return undefined;
    let frameId;

    const alignConnectorRail = () => {
      const nodes = [...grid.children].filter(child => child.classList.contains('area-map-node'));
      const railNodes = nodes.filter((_, index) => index % 2 === 0);
      const firstNode = railNodes[0];
      const lastNode = railNodes[railNodes.length - 1];
      if (!firstNode || !lastNode) return;

      const railTop = firstNode.offsetTop + (firstNode.offsetHeight / 2);
      const railBottom = grid.clientHeight - (lastNode.offsetTop + (lastNode.offsetHeight / 2));
      grid.style.setProperty('--map-rail-top', `${railTop}px`);
      grid.style.setProperty('--map-rail-bottom', `${Math.max(0, railBottom)}px`);
    };

    const scheduleAlignment = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(alignConnectorRail);
    };

    scheduleAlignment();
    grid.addEventListener('animationend', scheduleAlignment);
    window.addEventListener('resize', scheduleAlignment);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleAlignment);
    resizeObserver?.observe(grid);
    [...grid.children].forEach(child => resizeObserver?.observe(child));

    return () => {
      window.cancelAnimationFrame(frameId);
      grid.removeEventListener('animationend', scheduleAlignment);
      window.removeEventListener('resize', scheduleAlignment);
      resizeObserver?.disconnect();
    };
  }, [activeLayer, areaMapLevel, areaCatalog.length, operationMapNodes.length]);

  useEffect(() => {
    if (!tourOpen) return undefined;
    const currentStep = TOUR_STEPS[tourStep];
    setActiveLayer(currentStep.layer);
    if (currentStep.areaLevel) {
      setAreaMapLevel(currentStep.areaLevel);
      if (currentStep.areaLevel === 'operation') {
        setSelectedAreaId(OPERATION_ACADEMIC_AREA_ID);
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        storage.markHomeTourSeen();
        setTourOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [tourOpen, tourStep]);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query || !hasPermission('consultar')) return;
    storage.addSearchQuery(query);
    nav('search', { q: query });
  };

  const openTour = () => {
    setTourStep(0);
    setTourOpen(true);
  };

  const closeTour = () => {
    storage.markHomeTourSeen();
    setTourOpen(false);
  };

  const selectLayer = (layerId) => {
    setActiveLayer(layerId);
  };

  const handleLayerKeyDown = (event, index) => {
    const keyDirections = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = LAYERS.length - 1;
    else if (keyDirections[event.key]) {
      nextIndex = (index + keyDirections[event.key] + LAYERS.length) % LAYERS.length;
    } else {
      return;
    }
    event.preventDefault();
    const nextLayer = LAYERS[nextIndex];
    setActiveLayer(nextLayer.id);
    document.getElementById(`map-tab-${nextLayer.id}`)?.focus();
  };

  const selectAreaNode = (area) => {
    setSelectedAreaId(area.id);
    if (Number(area.id) === OPERATION_ACADEMIC_AREA_ID) {
      setAreaMapLevel('operation');
    }
  };

  const showMapPreview = (event, preview) => {
    const canvas = areaMapCanvasRef.current;
    const node = event.currentTarget;
    if (!canvas || !node) {
      setMapPreview(preview);
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const previewWidth = 342;
    const previewHeight = 380;
    const gap = 16;
    const nodeCenter = nodeRect.left - canvasRect.left + (nodeRect.width / 2);
    const preferredLeft = nodeCenter > canvasRect.width / 2
      ? nodeRect.left - canvasRect.left - previewWidth - gap
      : nodeRect.right - canvasRect.left + gap;
    const left = Math.max(18, Math.min(preferredLeft, canvasRect.width - previewWidth - 18));
    const preferredTop = nodeRect.top - canvasRect.top + (nodeRect.height / 2) - (previewHeight / 2);
    const top = Math.max(68, Math.min(preferredTop, canvasRect.height - previewHeight - 18));

    setMapPreview({ ...preview, position: { left, top } });
  };

  const openMapPreview = () => {
    if (!mapPreview) return;

    if (mapPreview.type === 'area') {
      if (Number(mapPreview.id) === OPERATION_ACADEMIC_AREA_ID) {
        setSelectedAreaId(OPERATION_ACADEMIC_AREA_ID);
        setAreaMapLevel('operation');
        return;
      }
      if (mapPreview.accessible) nav('library', { area: mapPreview.id });
      return;
    }

    if (!operationMapAccessible) return;
    const params = { area: OPERATION_ACADEMIC_AREA_ID };
    if (mapPreview.nodeKind === 'school') {
      params.coordination = mapPreview.coordinationId;
    }
    nav('library', params);
  };

  const currentScope = currentCoordination
    ? currentCoordination.name
    : currentArea
      ? currentArea.name
      : 'Alcance institucional';
  const mapPreviewDocumentCount = mapPreview?.type === 'area'
    ? Number(mapCounts.byArea[Number(mapPreview.id)]) || 0
    : mapPreview?.nodeKind === 'general'
      ? mapCounts.operationGeneral
      : Number(mapCounts.byCoordination[Number(mapPreview?.coordinationId)]) || 0;
  const mapPreviewCountLabel = mapCountsStatus === 'ready'
    ? `${mapPreviewDocumentCount} ${mapPreviewDocumentCount === 1 ? 'archivo cargado' : 'archivos cargados'}`
    : mapCountsStatus === 'loading'
      ? 'Consultando archivos…'
      : 'Conteo no disponible';
  const mapPreviewCanNavigate = Boolean(
    mapPreview
      && (mapPreview.accessible
        || (mapPreview.type === 'area' && Number(mapPreview.id) === OPERATION_ACADEMIC_AREA_ID)),
  );
  const documentCountAria = (count) => mapCountsStatus === 'ready'
    ? `${count} ${count === 1 ? 'archivo cargado' : 'archivos cargados'}`
    : 'conteo de archivos en curso';

  return (
    <div className="page fade-in map-home">
      <section className="map-home-hero" aria-labelledby="map-home-title">
        <div className="map-home-hero-main">
          <div className="eyebrow map-home-eyebrow">Centro de conocimiento operativo</div>
          <h1 id="map-home-title">Hola, {firstName}. ¿Qué necesitas hacer hoy?</h1>
          <p>Recorre el mapa de Acervo para encontrar documentos, entender el ciclo documental y conocer cómo se organizan las áreas y responsabilidades.</p>
          <form className="map-home-search" onSubmit={submitSearch} role="search">
            <Icon name="search" size={20} />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Busca por nombre, código o palabra clave…"
              aria-label="Buscar documentos"
              disabled={!hasPermission('consultar')}
            />
            <button
              type="submit"
              className="btn map-home-search-button"
              disabled={!searchQuery.trim() || !hasPermission('consultar')}
            >
              Buscar <Icon name="arrowRight" size={15} />
            </button>
          </form>
        </div>

        <aside className="map-home-profile" aria-label="Tu punto de partida">
          <div className="map-home-profile-head">
            <span className="map-home-profile-icon"><Icon name={currentRole?.icon || 'users'} size={21} /></span>
            <span className="badge map-home-you-badge"><span className="b-dot"></span>Tu punto de partida</span>
          </div>
          <strong>{roleName || currentRole?.name || 'Usuario de Acervo'}</strong>
          <p>{currentScope}</p>
          <div className="map-home-profile-meta">
            <span><Icon name="shield" size={14} />{effectivePermissions.length} permisos activos</span>
            {currentCoordination && <span><Icon name="pin" size={14} />Tu escuela</span>}
          </div>
          <button type="button" className="map-home-tour-link" onClick={openTour}>
            <Icon name="compass" size={15} /> Ver recorrido de la aplicación
          </button>
        </aside>
      </section>

      <section className="map-home-quick-section" aria-labelledby="quick-actions-title">
        <div className="map-home-section-head">
          <div>
            <span className="eyebrow">Accesos según tus permisos</span>
            <h2 id="quick-actions-title">Atajos para comenzar</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav('help')}>
            <Icon name="help" size={15} /> Centro de ayuda
          </button>
        </div>
        <div className="map-home-quick-grid">
          {quickActions.map(action => <QuickAction key={action.id} action={action} nav={nav} />)}
        </div>
      </section>

      <section className="map-home-explorer" aria-labelledby="map-explorer-title">
        <div className="map-home-explorer-head">
          <div>
            <span className="eyebrow">Mapa interactivo</span>
            <h2 id="map-explorer-title">Entiende Acervo de principio a fin</h2>
            <p>{LAYERS.find(layer => layer.id === activeLayer)?.description}</p>
          </div>
          <div className="map-home-layer-tabs" role="tablist" aria-label="Capas del mapa">
            {LAYERS.map((layer, index) => (
              <button
                key={layer.id}
                type="button"
                id={`map-tab-${layer.id}`}
                role="tab"
                aria-selected={activeLayer === layer.id}
                aria-controls={`map-panel-${layer.id}`}
                tabIndex={activeLayer === layer.id ? 0 : -1}
                className={activeLayer === layer.id ? 'active' : ''}
                onClick={() => selectLayer(layer.id)}
                onKeyDown={event => handleLayerKeyDown(event, index)}
              >
                <Icon name={layer.icon} size={16} />
                <span className="map-layer-label-full">{layer.label}</span>
                <span className="map-layer-label-short">{layer.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {activeLayer === 'process' && (
          <div
            id="map-panel-process"
            role="tabpanel"
            aria-labelledby="map-tab-process"
            className="map-home-layer map-home-process-layer"
          >
            <div className="process-routes">
              {PROCESS_ROUTES.map(route => (
                <article key={route.id} className="card process-route-card" style={{ '--route-color': route.color }}>
                  <header>
                    <span className="process-route-mark"><Icon name={route.id === 'consultation' ? 'search' : 'flow'} size={18} /></span>
                    <div>
                      <span className="eyebrow">{route.eyebrow}</span>
                      <h3>{route.label}</h3>
                    </div>
                    <span className="process-route-count mono">
                      {String(route.stations.length).padStart(2, '0')} etapas
                    </span>
                  </header>
                  <ol className="process-stations">
                    {route.stations.map((station, index) => (
                      <ProcessStation
                        key={station.id}
                        station={station}
                        index={index}
                        routeColor={route.color}
                        selected={selectedStationId === station.id}
                        allowed={!station.permission || hasPermission(station.permission)}
                        onSelect={setSelectedStationId}
                      />
                    ))}
                  </ol>
                </article>
              ))}
            </div>

            <aside className="card process-detail-card" aria-live="polite">
              <div className="process-detail-top">
                <span className="process-detail-icon"><Icon name={selectedStation.icon} size={22} /></span>
                <div>
                  <span className="eyebrow">Estación seleccionada</span>
                  <h3>{selectedStation.title}</h3>
                </div>
                <span className={`badge ${selectedStationAllowed ? 'map-badge-available' : 'map-badge-restricted'}`}>
                  <span className="b-dot"></span>{selectedStationAllowed ? 'Disponible' : 'Restringida'}
                </span>
              </div>
              <p className="process-detail-description">{selectedStation.detail}</p>
              <dl className="process-detail-list">
                <div><dt>Dónde</dt><dd>{selectedStation.location}</dd></div>
                <div><dt>Quién participa</dt><dd>{selectedStation.actors}</dd></div>
                <div><dt>Permiso relacionado</dt><dd>{selectedStation.permission ? PERMISSION_LABELS[selectedStation.permission] : 'No aplica'}</dd></div>
              </dl>
              {!selectedStationAllowed && (
                <div className="map-restriction-note">
                  <Icon name="lock" size={15} />
                  Puedes conocer esta etapa, pero tu sesión actual no tiene el permiso necesario para ejecutarla.
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary process-detail-action"
                disabled={!selectedStationAllowed}
                onClick={() => nav(selectedStation.view)}
              >
                {selectedStation.actionLabel} <Icon name="arrowRight" size={15} />
              </button>
            </aside>
          </div>
        )}

        {activeLayer === 'areas' && (
          <div
            id="map-panel-areas"
            role="tabpanel"
            aria-labelledby="map-tab-areas"
            className="map-home-layer map-home-area-layer"
          >
            <div
              ref={areaMapCanvasRef}
              className={`card area-map-canvas ${areaMapLevel === 'operation' ? 'is-operation' : ''}`}
              style={{
                '--map-core-color': areaMapLevel === 'operation'
                  ? AREA_VISUALS[OPERATION_ACADEMIC_AREA_ID].color
                  : 'var(--brand-700)',
              }}
              onMouseLeave={() => setMapPreview(null)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setMapPreview(null);
              }}
            >
              {areaMapLevel === 'operation' ? (
                <button type="button" className="area-map-back" onClick={() => setAreaMapLevel('areas')}>
                  <Icon name="chevLeft" size={14} />
                  <span><small>Volver al mapa</small><strong>Todas las áreas</strong></span>
                </button>
              ) : (
                <div className="area-map-legend" aria-label="Convenciones del mapa">
                  <span><i className="area-map-legend-dot"></i>Pasa el cursor para explorar</span>
                  <span><Icon name="lock" size={11} />Vista informativa</span>
                </div>
              )}

              <div key={`core-${areaMapLevel}`} className="area-map-core">
                <span className="area-map-core-icon">
                  {areaMapLevel === 'operation' ? (
                    <img
                      className="area-map-core-mascot"
                      src={OPERATION_VISUALS.general.mascot}
                      alt=""
                      aria-hidden="true"
                    />
                  ) : (
                    <Icon name="library" size={30} />
                  )}
                </span>
                <span className="eyebrow">
                  {areaMapLevel === 'operation' ? 'Área seleccionada' : 'Repositorio central'}
                </span>
                <strong>
                  {areaMapLevel === 'operation' ? 'Operación Académica' : 'Acervo Operaciones'}
                </strong>
                <small>
                  {areaMapLevel === 'operation'
                    ? 'Documentos generales y escuelas'
                    : 'Una biblioteca, múltiples áreas'}
                </small>
                <span className="area-map-core-count">
                  <i></i>
                  {areaMapLevel === 'operation'
                    ? `${operationCoordinations.length} escuelas + general`
                    : `${areaCatalog.length} áreas conectadas`}
                </span>
              </div>

              <div key={`connector-${areaMapLevel}`} className="area-map-connector" aria-hidden="true"></div>

              <div ref={areaMapGridRef} key={`grid-${areaMapLevel}`} className="area-map-grid">
                {areaMapLevel === 'operation' ? (
                  operationMapNodes.map((node, index) => {
                    const isCurrent = node.kind === 'school'
                      && Number(user?.coordination) === Number(node.coordinationId);
                    const selected = node.id === selectedOperationNodeId;
                    const documentCount = node.kind === 'general'
                      ? mapCounts.operationGeneral
                      : Number(mapCounts.byCoordination[Number(node.coordinationId)]) || 0;
                    const preview = {
                      type: 'operation',
                      id: node.id,
                      name: node.name,
                      abbreviation: node.abbreviation,
                      color: node.color,
                      contrast: node.contrast,
                      mascot: node.mascot,
                      nodeKind: node.kind,
                      coordinationId: node.coordinationId,
                      accessible: operationMapAccessible,
                      isCurrent,
                      description: node.kind === 'general'
                        ? 'Documentos transversales de Operación Académica, compartidos por todas sus escuelas.'
                        : 'Biblioteca documental propia de esta subcoordinación dentro de Operación Académica.',
                      actionLabel: node.kind === 'general'
                        ? 'Abrir documentos generales'
                        : 'Abrir biblioteca de la escuela',
                    };
                    return (
                      <button
                        key={node.id}
                        type="button"
                        className={`area-map-node operation-map-node ${selected ? 'selected' : ''} ${operationMapAccessible ? '' : 'informative'}`}
                        style={{
                          '--area-color': node.color,
                          '--area-delay': `${index * 55}ms`,
                        }}
                        onMouseEnter={(event) => showMapPreview(event, preview)}
                        onFocus={(event) => showMapPreview(event, preview)}
                        onClick={(event) => {
                          setSelectedOperationNodeId(node.id);
                          showMapPreview(event, preview);
                        }}
                        aria-pressed={selected}
                        aria-label={`${node.name}, ${documentCountAria(documentCount)}${isCurrent ? ', tu escuela' : ''}${operationMapAccessible ? '' : ', vista informativa'}`}
                      >
                        <span className="area-map-node-line" aria-hidden="true"></span>
                        <span className="area-map-node-icon">
                          <img src={node.mascot} alt="" aria-hidden="true" />
                        </span>
                        <span className="area-map-node-copy">
                          <strong>{node.name}</strong>
                          <small className="mono">{node.abbreviation}</small>
                        </span>
                        {isCurrent && (
                          <span className="area-map-node-status">
                            <Icon name="check" size={10} />Tu escuela
                          </span>
                        )}
                        <span
                          className={`area-map-node-access ${operationMapAccessible ? 'available' : 'restricted'}`}
                          title={operationMapAccessible ? 'Ver detalle' : 'Vista informativa'}
                          aria-hidden="true"
                        >
                          <Icon name={operationMapAccessible ? 'chevRight' : 'lock'} size={operationMapAccessible ? 14 : 12} />
                        </span>
                      </button>
                    );
                  })
                ) : (
                  areaCatalog.map((area, index) => {
                    const isCurrent = Number(user?.area) === Number(area.id);
                    const accessible = canOpenArea(area);
                    const selected = Number(selectedAreaId) === Number(area.id);
                    const isOperationArea = Number(area.id) === OPERATION_ACADEMIC_AREA_ID;
                    const documentCount = Number(mapCounts.byArea[Number(area.id)]) || 0;
                    const preview = {
                      type: 'area',
                      id: area.id,
                      name: area.name,
                      abbreviation: area.abbreviation,
                      color: area.color,
                      contrast: area.contrast,
                      mascot: area.mascot,
                      accessible,
                      isCurrent,
                      description: isOperationArea
                        ? 'Combina documentos generales, compartidos por todas las escuelas, con documentos propios de cada subcoordinación.'
                        : `Reúne los documentos, procedimientos, formatos y manuales asociados a ${area.name}.`,
                      actionLabel: isOperationArea
                        ? 'Explorar escuelas y documentos'
                        : 'Abrir biblioteca del área',
                    };
                    return (
                      <button
                        key={area.id}
                        type="button"
                        className={`area-map-node ${selected ? 'selected' : ''} ${accessible ? '' : 'informative'}`}
                        style={{
                          '--area-color': area.color,
                          '--area-delay': `${index * 55}ms`,
                        }}
                        onMouseEnter={(event) => showMapPreview(event, preview)}
                        onFocus={(event) => showMapPreview(event, preview)}
                        onClick={(event) => {
                          showMapPreview(event, preview);
                          selectAreaNode(area);
                        }}
                        aria-pressed={selected}
                        aria-label={`${area.name}, ${documentCountAria(documentCount)}${isCurrent ? ', tu área' : ''}${accessible ? '' : ', vista informativa'}`}
                      >
                        <span className="area-map-node-line" aria-hidden="true"></span>
                        <span className="area-map-node-icon">
                          <img src={area.mascot} alt="" aria-hidden="true" />
                        </span>
                        <span className="area-map-node-copy">
                          <strong>{area.name}</strong>
                          <small className="mono">{area.abbreviation}</small>
                        </span>
                        {isCurrent && (
                          <span className="area-map-node-status">
                            <Icon name="check" size={10} />Tu área
                          </span>
                        )}
                        <span
                          className={`area-map-node-access ${accessible || isOperationArea ? 'available' : 'restricted'}`}
                          title={isOperationArea ? 'Explorar sus escuelas' : accessible ? 'Ver detalle del área' : 'Vista informativa'}
                          aria-hidden="true"
                        >
                          <Icon name={accessible || isOperationArea ? 'chevRight' : 'lock'} size={accessible || isOperationArea ? 14 : 12} />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {mapPreview && (
                <aside
                  className="area-map-hover-card"
                  style={{
                    '--area-color': mapPreview.color,
                    '--area-contrast': mapPreview.contrast || '#fff',
                    left: mapPreview.position?.left,
                    top: mapPreview.position?.top,
                  }}
                  aria-live="polite"
                  aria-label={`Información de ${mapPreview.name}`}
                >
                  <header>
                    <span className="area-map-hover-mascot">
                      <img src={mapPreview.mascot} alt="" aria-hidden="true" />
                    </span>
                    <div>
                      <span className="mono area-map-hover-code">{mapPreview.abbreviation}</span>
                      <h3>{mapPreview.name}</h3>
                    </div>
                    {mapPreview.isCurrent && (
                      <span className="area-map-hover-current">
                        <Icon name="check" size={10} />
                        {mapPreview.type === 'area' ? 'Tu área' : 'Tu escuela'}
                      </span>
                    )}
                  </header>

                  <p>{mapPreview.description}</p>

                  <div className="area-map-hover-count">
                    <span><Icon name="file" size={20} /></span>
                    <div>
                      <strong>{mapPreviewCountLabel}</strong>
                      <small>Registrados en esta área o subárea</small>
                    </div>
                  </div>

                  {!mapPreviewCanNavigate && (
                    <div className="area-map-hover-restriction">
                      <Icon name="lock" size={14} />
                      Puedes conocer esta rama, pero tu perfil no habilita su biblioteca.
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary area-map-hover-action"
                    disabled={!mapPreviewCanNavigate}
                    onClick={openMapPreview}
                  >
                    {mapPreviewCanNavigate ? mapPreview.actionLabel : 'Vista informativa'}
                    <Icon name={mapPreviewCanNavigate ? 'arrowRight' : 'lock'} size={14} />
                  </button>
                </aside>
              )}
            </div>
          </div>
        )}

        {activeLayer === 'roles' && (
          <div
            id="map-panel-roles"
            role="tabpanel"
            aria-labelledby="map-tab-roles"
            className="map-home-layer map-home-role-layer"
          >
            <div className="card role-map-canvas">
              <div className="role-map-intro">
                <div>
                  <span className="eyebrow">Responsabilidades de referencia</span>
                  <h3>Selecciona un rol para conocer su participación</h3>
                </div>
                <span className="role-map-rule"><Icon name="shield" size={14} />Las acciones reales dependen de permisos efectivos y asignaciones.</span>
              </div>
              <div className="role-node-grid">
                {ROLE_REFERENCE.map((role, index) => {
                  const selected = Number(role.id) === Number(selectedRoleId);
                  const isCurrent = Number(role.id) === currentRoleId;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      className={`role-node ${selected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                      style={{ '--role-delay': `${index * 55}ms` }}
                      onClick={() => setSelectedRoleId(role.id)}
                      aria-pressed={selected}
                    >
                      <span className="role-node-number mono">{String(role.id).padStart(2, '0')}</span>
                      <span className="role-node-icon"><Icon name={role.icon} size={17} /></span>
                      <span className="role-node-name">{role.name}</span>
                      {isCurrent && <span className="role-node-current">Tu rol</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="card role-detail-card">
              <header>
                <span className="role-detail-icon"><Icon name={selectedRole.icon} size={22} /></span>
                <div>
                  <span className="eyebrow">{selectedRoleIsCurrent ? 'Tu rol actual' : 'Rol de referencia'}</span>
                  <h3>{selectedRoleIsCurrent && roleName ? roleName : selectedRole.name}</h3>
                </div>
                {selectedRoleIsCurrent && <span className="badge map-badge-available"><span className="b-dot"></span>Tu rol</span>}
              </header>
              <p className="role-detail-summary">{selectedRole.summary}</p>
              <div className="role-scope">
                <Icon name="pin" size={15} />
                <span><strong>Alcance</strong>{selectedRole.scope}</span>
              </div>

              <div className="role-stage-map" aria-label="Etapas relacionadas con el rol">
                {ROLE_STAGES.map(stage => {
                  const active = selectedRole.stages.includes(stage.id);
                  return (
                    <span key={stage.id} className={active ? 'active' : ''}>
                      <Icon name={stage.icon} size={14} />{stage.label}
                    </span>
                  );
                })}
              </div>

              <div className="role-permissions">
                <div className="role-detail-subhead">
                  <strong>{selectedRoleIsCurrent ? 'Tus permisos efectivos' : 'Permisos de referencia'}</strong>
                  {selectedRoleIsCurrent && <small>Obtenidos de tu sesión</small>}
                </div>
                <div className="role-permission-list">
                  {rolePermissions.map(permission => (
                    <span key={permission}><Icon name="check" size={12} />{PERMISSION_LABELS[permission] || permission}</span>
                  ))}
                </div>
              </div>

              {selectedRoleIsCurrent && (
                <div className="map-restriction-note role-effective-note">
                  <Icon name="shield" size={15} />
                  El área, la escuela y las asignaciones del flujo siguen limitando cada acción aunque el permiso esté activo.
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      <section className="map-home-destinations" aria-labelledby="file-destinations-title">
        <div className="map-home-section-head">
          <div>
            <span className="eyebrow">Mapa de ubicación</span>
            <h2 id="file-destinations-title">¿Dónde encuentro cada archivo?</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!hasPermission('consultar')}
            onClick={() => nav('library')}
          >
            Ver biblioteca completa <Icon name="arrowRight" size={15} />
          </button>
        </div>
        <div className="map-home-destination-grid">
          {FILE_DESTINATIONS.map((destination, index) => (
            <button
              key={destination.id}
              type="button"
              className="map-home-destination"
              disabled={!hasPermission('consultar')}
              onClick={() => nav(destination.view, destination.params)}
            >
              <span className="map-home-destination-number mono">{String(index + 1).padStart(2, '0')}</span>
              <span className="map-home-destination-icon"><Icon name={destination.icon} size={19} /></span>
              <span className="map-home-destination-copy">
                <strong>{destination.title}</strong>
                <small>{destination.description}</small>
              </span>
              <Icon name="arrowRight" size={15} className="map-home-destination-arrow" />
            </button>
          ))}
        </div>
      </section>

      <section className="map-home-guide card" aria-labelledby="map-guide-title">
        <div className="map-home-guide-icon"><Icon name="compass" size={22} /></div>
        <div>
          <span className="eyebrow">Guía rápida</span>
          <h2 id="map-guide-title">Encuentra un archivo en tres pasos</h2>
        </div>
        <ol>
          <li><span>1</span><strong>Busca o elige un área</strong><small>Utiliza el buscador o abre una biblioteca.</small></li>
          <li><span>2</span><strong>Abre la ficha</strong><small>Comprueba el código, versión y alcance.</small></li>
          <li><span>3</span><strong>Usa la acción disponible</strong><small>Consulta, descarga o solicita actualización.</small></li>
        </ol>
        <button type="button" className="btn btn-ghost" onClick={openTour}>
          Ver recorrido <Icon name="arrowRight" size={15} />
        </button>
      </section>

      {tourOpen && (
        <TourDialog
          step={tourStep}
          onBack={() => setTourStep(current => Math.max(0, current - 1))}
          onNext={() => setTourStep(current => Math.min(TOUR_STEPS.length - 1, current + 1))}
          onSkip={closeTour}
        />
      )}
    </div>
  );
}
