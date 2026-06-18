/* ============================================================
   ACERVO — Datos mock (reemplazables por datos reales)
   ============================================================ */

const AREAS = [
    { id: 'fco', name: 'Fábrica de Contenidos', abbreviation: 'FCO', color: 'var(--area-fco)', lead: 'Laura Restrepo Mejía' },
    { id: 'pra', name: 'Prácticas', abbreviation: 'PRA', color: 'var(--area-pra)', lead: 'Mauricio Salazar Ríos' },
    { id: 'hom', name: 'Homologaciones', abbreviation: 'HOM', color: 'var(--area-hom)', lead: 'Diana Marcela Ruiz' },
    { id: 'oap', name: 'Operación Académica de Pregrado', abbreviation: 'OAP', color: 'var(--area-oap)', lead: 'Carlos Andrés Gómez' },
    { id: 'opg', name: 'Operación Académica de Posgrado', abbreviation: 'OPG', color: 'var(--area-opg)', lead: 'Andrea Forero Castro' },
    { id: 'psb', name: 'Pruebas Saber', abbreviation: 'PSB', color: 'var(--area-psb)', lead: 'Julián Ospina Vélez' },
  ];

  const TYPES = [
    { id: 'procedimiento', name: 'Procedimiento', abbreviation: 'PR', icon: 'flow' },
    { id: 'manual_funciones', name: 'Manual de funciones', abbreviation: 'MF', icon: 'briefcase' },
    { id: 'descriptor', name: 'Descriptor de cargo', abbreviation: 'DC', icon: 'idcard' },
    { id: 'manual_app', name: 'Manual de aplicación', abbreviation: 'MA', icon: 'app' },
    { id: 'ans', name: 'ANS', abbreviation: 'ANS', icon: 'handshake' },
    { id: 'formato', name: 'Formato', abbreviation: 'FT', icon: 'form' },
    { id: 'instructivo', name: 'Instructivo', abbreviation: 'IN', icon: 'list' },
    { id: 'guia', name: 'Guía', abbreviation: 'GU', icon: 'compass' },
    { id: 'politica', name: 'Política', abbreviation: 'PO', icon: 'shield' },
  ];

  const STATES = {
    aprobado:  { label: 'Aprobado', cls: 'aprobado' },
    publicado: { label: 'Publicado', cls: 'publicado' },
    revision:  { label: 'En revisión', cls: 'revision' },
    borrador:  { label: 'Borrador', cls: 'borrador' },
    vencido:   { label: 'Vencido', cls: 'vencido' },
    archivado: { label: 'Archivado', cls: 'archivado' },
  };

  const PEOPLE = {
    laura: { name: 'Laura Restrepo Mejía', role: 'Líder Fábrica de Contenidos', area: 'fco' },
    mauricio: { name: 'Mauricio Salazar Ríos', role: 'Líder Prácticas', area: 'pra' },
    diana: { name: 'Diana Marcela Ruiz', role: 'Líder Homologaciones', area: 'hom' },
    carlos: { name: 'Carlos Andrés Gómez', role: 'Líder Op. Pregrado', area: 'oap' },
    andrea: { name: 'Andrea Forero Castro', role: 'Líder Op. Posgrado', area: 'opg' },
    julian: { name: 'Julián Ospina Vélez', role: 'Líder Pruebas Saber', area: 'psb' },
    paula: { name: 'Paula Rendón Loaiza', role: 'Editora documental', area: 'fco' },
    sebastian: { name: 'Sebastián Cárdenas', role: 'Analista de procesos', area: 'hom' },
    valentina: { name: 'Valentina Ríos Tamayo', role: 'Coordinadora académica', area: 'oap' },
    felipe: { name: 'Felipe Arango Mesa', role: 'Desarrollador / Resp. técnico', area: 'fco' },
  };

  function ver(v, date, by, note) { return { v, date, by, note }; }

  // Documentos
  const DOCS = [
    // ---- Fábrica de Contenidos
    { id: 'd01', area: 'fco', type: 'procedimiento', documentNumber: 'FCO-PR-001', name: 'Producción de objetos virtuales de aprendizaje (OVA)',
      version: '3.2', state: 'publicado', created: '2023-02-14', updated: '2025-11-03', owner: 'laura', vigencia: '2026-11-03', fav: true, views: 482,
      desc: 'Define las etapas para diseñar, producir y publicar OVA: guion, storyboard, producción multimedia y control de calidad.',
      tags: ['ova','producción','multimedia','calidad'],
      history: [ ver('3.2','2025-11-03','paula','Actualización de checklist de accesibilidad WCAG'), ver('3.1','2025-05-20','laura','Se incorpora etapa de revisión pedagógica'), ver('3.0','2024-09-10','laura','Rediseño completo del flujo'), ver('2.0','2023-08-01','paula','Versión 2'), ver('1.0','2023-02-14','laura','Creación') ],
      related: ['d02','d03','d05'] },
    { id: 'd02', area: 'fco', type: 'manual_funciones', documentNumber: 'FCO-MF-004', name: 'Manual de funciones — Diseñador instruccional',
      version: '2.0', state: 'publicado', created: '2023-04-02', updated: '2025-07-18', owner: 'laura', vigencia: '2026-07-18', fav: false, views: 318,
      desc: 'Funciones, responsabilidades y competencias del rol de diseñador instruccional dentro de la Fábrica de Contenidos.',
      tags: ['cargo','diseño instruccional','competencias'], cargo: 'c01',
      history: [ ver('2.0','2025-07-18','laura','Ajuste de competencias técnicas'), ver('1.0','2023-04-02','laura','Creación') ],
      related: ['d03','d01'] },
    { id: 'd03', area: 'fco', type: 'descriptor', documentNumber: 'FCO-DC-003', name: 'Descriptor de cargo — Productor multimedia',
      version: '1.4', state: 'aprobado', created: '2023-06-12', updated: '2025-09-22', owner: 'paula', vigencia: '2026-09-22', fav: false, views: 201,
      desc: 'Perfil, propósito y relaciones del cargo de productor multimedia.', tags: ['cargo','multimedia','perfil'], cargo: 'c02',
      history: [ ver('1.4','2025-09-22','paula','Actualización de herramientas'), ver('1.0','2023-06-12','paula','Creación') ], related: ['d02'] },
    { id: 'd04', area: 'fco', type: 'guia', documentNumber: 'FCO-GU-002', name: 'Guía de estilo audiovisual institucional',
      version: '2.1', state: 'revision', created: '2024-01-20', updated: '2026-01-15', owner: 'felipe', vigencia: '2027-01-15', fav: true, views: 356,
      desc: 'Lineamientos de identidad visual, tipografía, color y narrativa para piezas audiovisuales.', tags: ['estilo','audiovisual','marca'],
      history: [ ver('2.1','2026-01-15','felipe','En revisión por comité de marca'), ver('2.0','2025-02-01','felipe','Versión 2'), ver('1.0','2024-01-20','felipe','Creación') ], related: ['d01'] },
    { id: 'd05', area: 'fco', type: 'formato', documentNumber: 'FCO-FT-007', name: 'Formato de solicitud de contenido',
      version: '1.2', state: 'publicado', created: '2023-09-05', updated: '2025-03-11', owner: 'paula', vigencia: '2026-09-05', fav: false, views: 540,
      desc: 'Plantilla para que las áreas soliciten producción de nuevo contenido.', tags: ['formato','solicitud'],
      history: [ ver('1.2','2025-03-11','paula','Campos adicionales'), ver('1.0','2023-09-05','paula','Creación') ], related: ['d01'] },

    // ---- Prácticas
    { id: 'd06', area: 'pra', type: 'procedimiento', documentNumber: 'PRA-PR-002', name: 'Legalización de prácticas profesionales',
      version: '4.0', state: 'publicado', created: '2022-08-10', updated: '2025-10-28', owner: 'mauricio', vigencia: '2026-10-28', fav: true, views: 612,
      desc: 'Proceso completo de legalización: convenio, afiliación ARL, asignación de tutor y seguimiento.', tags: ['prácticas','convenio','arl','legalización'],
      history: [ ver('4.0','2025-10-28','mauricio','Integración con afiliación digital ARL'), ver('3.0','2024-06-15','mauricio','Versión 3'), ver('1.0','2022-08-10','mauricio','Creación') ], related: ['d07','d08','d10'] },
    { id: 'd07', area: 'pra', type: 'ans', documentNumber: 'PRA-ANS-001', name: 'ANS — Convenios de práctica con empresas aliadas',
      version: '2.0', state: 'publicado', created: '2023-03-01', updated: '2025-08-14', owner: 'mauricio', vigencia: '2026-08-14', fav: false, views: 274, ans: 'a01',
      desc: 'Acuerdo de nivel de servicio para la gestión y respuesta de convenios de práctica.', tags: ['ans','convenios','empresas'],
      history: [ ver('2.0','2025-08-14','mauricio','Ajuste de tiempos de respuesta'), ver('1.0','2023-03-01','mauricio','Creación') ], related: ['d06'] },
    { id: 'd08', area: 'pra', type: 'manual_funciones', documentNumber: 'PRA-MF-002', name: 'Manual de funciones — Coordinador de prácticas',
      version: '1.3', state: 'vencido', created: '2022-11-04', updated: '2024-02-09', owner: 'mauricio', vigencia: '2025-02-09', fav: false, views: 189, cargo: 'c03',
      desc: 'Funciones del coordinador de prácticas. Requiere actualización por cambio de estructura.', tags: ['cargo','coordinador'],
      history: [ ver('1.3','2024-02-09','mauricio','Versión 1.3'), ver('1.0','2022-11-04','mauricio','Creación') ], related: ['d06'] },
    { id: 'd09', area: 'pra', type: 'instructivo', documentNumber: 'PRA-IN-005', name: 'Instructivo de registro de horas de práctica',
      version: '1.1', state: 'publicado', created: '2024-04-18', updated: '2025-06-30', owner: 'mauricio', vigencia: '2026-06-30', fav: false, views: 421,
      desc: 'Cómo registrar y validar las horas de práctica en el sistema.', tags: ['horas','registro','instructivo'],
      history: [ ver('1.1','2025-06-30','mauricio','Corrección de pantallazos'), ver('1.0','2024-04-18','mauricio','Creación') ], related: ['d06'] },
    { id: 'd10', area: 'pra', type: 'formato', documentNumber: 'PRA-FT-011', name: 'Formato de evaluación del practicante',
      version: '2.2', state: 'aprobado', created: '2023-01-25', updated: '2025-12-01', owner: 'mauricio', vigencia: '2026-12-01', fav: false, views: 298,
      desc: 'Rúbrica de evaluación del desempeño del practicante por parte del tutor empresarial.', tags: ['evaluación','rúbrica'],
      history: [ ver('2.2','2025-12-01','mauricio','Nueva rúbrica por competencias'), ver('1.0','2023-01-25','mauricio','Creación') ], related: ['d06'] },

    // ---- Homologaciones
    { id: 'd11', area: 'hom', type: 'procedimiento', documentNumber: 'HOM-PR-001', name: 'Homologación de asignaturas',
      version: '5.1', state: 'publicado', created: '2021-07-02', updated: '2026-02-10', owner: 'diana', vigencia: '2027-02-10', fav: true, views: 731,
      desc: 'Procedimiento para evaluar y aprobar la equivalencia de asignaturas de estudiantes provenientes de otras instituciones.', tags: ['homologación','equivalencias','asignaturas'],
      history: [ ver('5.1','2026-02-10','diana','Reducción de tiempos por automatización'), ver('5.0','2025-01-12','diana','Versión 5'), ver('4.0','2023-03-20','sebastian','Versión 4'), ver('1.0','2021-07-02','diana','Creación') ], related: ['d12','d13','d14','d15'] },
    { id: 'd12', area: 'hom', type: 'ans', documentNumber: 'HOM-ANS-002', name: 'ANS — Respuesta a solicitudes de homologación',
      version: '3.0', state: 'aprobado', created: '2022-05-09', updated: '2025-11-20', owner: 'diana', vigencia: '2026-11-20', fav: true, views: 408, ans: 'a02',
      desc: 'Tiempos y compromisos de respuesta para las solicitudes de homologación de los estudiantes.', tags: ['ans','homologación','tiempos'],
      history: [ ver('3.0','2025-11-20','diana','Nuevos tiempos de resolución'), ver('2.0','2024-01-15','diana','Versión 2'), ver('1.0','2022-05-09','diana','Creación') ], related: ['d11','d14'] },
    { id: 'd13', area: 'hom', type: 'descriptor', documentNumber: 'HOM-DC-001', name: 'Descriptor de cargo — Analista de homologaciones',
      version: '2.0', state: 'publicado', created: '2022-09-14', updated: '2025-10-05', owner: 'sebastian', vigencia: '2026-10-05', fav: false, views: 167, cargo: 'c04',
      desc: 'Perfil y propósito del analista de homologaciones.', tags: ['cargo','analista'],
      history: [ ver('2.0','2025-10-05','sebastian','Versión 2'), ver('1.0','2022-09-14','sebastian','Creación') ], related: ['d11'] },
    { id: 'd14', area: 'hom', type: 'manual_app', documentNumber: 'HOM-MA-001', name: 'Manual de aplicación — Sistema de Homologaciones (SIHO)',
      version: '2.3', state: 'publicado', created: '2023-10-01', updated: '2026-01-28', owner: 'felipe', vigencia: '2027-01-28', fav: true, views: 389, app: 'ap01',
      desc: 'Manual de usuario y técnico del Sistema Interno de Homologaciones (SIHO).', tags: ['siho','aplicación','manual'],
      history: [ ver('2.3','2026-01-28','felipe','Documentación del módulo de reportes'), ver('2.0','2025-04-10','felipe','Versión 2'), ver('1.0','2023-10-01','felipe','Creación') ], related: ['d11','d12'] },
    { id: 'd15', area: 'hom', type: 'politica', documentNumber: 'HOM-PO-001', name: 'Política de equivalencias académicas',
      version: '1.0', state: 'revision', created: '2026-01-10', updated: '2026-02-22', owner: 'diana', vigencia: '2028-02-22', fav: false, views: 92,
      desc: 'Marco institucional para definir criterios de equivalencia entre programas y asignaturas.', tags: ['política','equivalencias','criterios'],
      history: [ ver('1.0','2026-02-22','diana','Borrador en revisión por Vicerrectoría'), ], related: ['d11'] },
    { id: 'd16', area: 'hom', type: 'guia', documentNumber: 'HOM-GU-003', name: 'Guía rápida para el solicitante de homologación',
      version: '0.9', state: 'borrador', created: '2026-02-18', updated: '2026-02-18', owner: 'sebastian', vigencia: '—', fav: false, views: 14,
      desc: 'Guía orientada al estudiante para radicar correctamente su solicitud.', tags: ['guía','estudiante','radicación'],
      history: [ ver('0.9','2026-02-18','sebastian','Primer borrador') ], related: ['d11'] },

    // ---- Op. Pregrado
    { id: 'd17', area: 'oap', type: 'procedimiento', documentNumber: 'OAP-PR-004', name: 'Programación académica de pregrado',
      version: '3.0', state: 'publicado', created: '2022-04-11', updated: '2025-12-15', owner: 'carlos', vigencia: '2026-12-15', fav: true, views: 553,
      desc: 'Planeación de oferta, asignación docente, horarios y apertura de grupos por periodo.', tags: ['programación','horarios','oferta'],
      history: [ ver('3.0','2025-12-15','carlos','Integración con portal de programación'), ver('2.0','2024-03-01','carlos','Versión 2'), ver('1.0','2022-04-11','carlos','Creación') ], related: ['d18','d19','d20','d21'] },
    { id: 'd18', area: 'oap', type: 'manual_funciones', documentNumber: 'OAP-MF-001', name: 'Manual de funciones — Coordinador académico de pregrado',
      version: '2.1', state: 'aprobado', created: '2022-06-20', updated: '2025-09-08', owner: 'carlos', vigencia: '2026-09-08', fav: false, views: 244, cargo: 'c05',
      desc: 'Funciones del coordinador académico de pregrado.', tags: ['cargo','coordinador','pregrado'],
      history: [ ver('2.1','2025-09-08','carlos','Ajuste de KPIs'), ver('1.0','2022-06-20','carlos','Creación') ], related: ['d17'] },
    { id: 'd19', area: 'oap', type: 'ans', documentNumber: 'OAP-ANS-003', name: 'ANS — Atención a novedades de matrícula',
      version: '2.0', state: 'publicado', created: '2023-07-19', updated: '2025-07-30', owner: 'carlos', vigencia: '2026-07-30', fav: false, views: 367, ans: 'a03',
      desc: 'Tiempos de atención y resolución de novedades de matrícula reportadas por estudiantes.', tags: ['ans','matrícula','novedades'],
      history: [ ver('2.0','2025-07-30','carlos','Versión 2'), ver('1.0','2023-07-19','carlos','Creación') ], related: ['d17'] },
    { id: 'd20', area: 'oap', type: 'manual_app', documentNumber: 'OAP-MA-002', name: 'Manual de aplicación — Portal de Programación Académica',
      version: '1.5', state: 'revision', created: '2024-08-22', updated: '2026-02-05', owner: 'valentina', vigencia: '2027-02-05', fav: false, views: 178, app: 'ap02',
      desc: 'Manual de usuario del portal de programación académica.', tags: ['portal','programación','manual'],
      history: [ ver('1.5','2026-02-05','valentina','Revisión módulo de horarios'), ver('1.0','2024-08-22','valentina','Creación') ], related: ['d17'] },
    { id: 'd21', area: 'oap', type: 'instructivo', documentNumber: 'OAP-IN-008', name: 'Instructivo de apertura de grupos',
      version: '1.2', state: 'vencido', created: '2023-02-28', updated: '2024-08-30', owner: 'valentina', vigencia: '2025-08-30', fav: false, views: 156,
      desc: 'Criterios y pasos para la apertura y cierre de grupos por periodo.', tags: ['grupos','apertura','periodo'],
      history: [ ver('1.2','2024-08-30','valentina','Versión 1.2'), ver('1.0','2023-02-28','valentina','Creación') ], related: ['d17'] },

    // ---- Op. Posgrado
    { id: 'd22', area: 'opg', type: 'procedimiento', documentNumber: 'OPG-PR-002', name: 'Matrícula de posgrado',
      version: '2.4', state: 'publicado', created: '2022-10-03', updated: '2025-11-12', owner: 'andrea', vigencia: '2026-11-12', fav: true, views: 312,
      desc: 'Proceso de matrícula para programas de especialización y maestría por cohortes.', tags: ['matrícula','posgrado','cohortes'],
      history: [ ver('2.4','2025-11-12','andrea','Ajuste por nuevas cohortes'), ver('2.0','2024-05-09','andrea','Versión 2'), ver('1.0','2022-10-03','andrea','Creación') ], related: ['d23','d24','d25'] },
    { id: 'd23', area: 'opg', type: 'manual_funciones', documentNumber: 'OPG-MF-001', name: 'Manual de funciones — Coordinador de posgrado',
      version: '1.2', state: 'aprobado', created: '2023-05-16', updated: '2025-08-21', owner: 'andrea', vigencia: '2026-08-21', fav: false, views: 158, cargo: 'c06',
      desc: 'Funciones del coordinador de programas de posgrado.', tags: ['cargo','coordinador','posgrado'],
      history: [ ver('1.2','2025-08-21','andrea','Versión 1.2'), ver('1.0','2023-05-16','andrea','Creación') ], related: ['d22'] },
    { id: 'd24', area: 'opg', type: 'ans', documentNumber: 'OPG-ANS-001', name: 'ANS — Gestión de cohortes de posgrado',
      version: '0.8', state: 'borrador', created: '2026-02-01', updated: '2026-02-20', owner: 'andrea', vigencia: '—', fav: false, views: 23, ans: 'a04',
      desc: 'Borrador del acuerdo de nivel de servicio para apertura y gestión de cohortes.', tags: ['ans','cohortes','borrador'],
      history: [ ver('0.8','2026-02-20','andrea','Primer borrador') ], related: ['d22'] },
    { id: 'd25', area: 'opg', type: 'descriptor', documentNumber: 'OPG-DC-002', name: 'Descriptor de cargo — Asesor de posgrado',
      version: '1.0', state: 'publicado', created: '2023-11-08', updated: '2025-04-14', owner: 'andrea', vigencia: '2026-04-14', fav: false, views: 134, cargo: 'c07',
      desc: 'Perfil del asesor comercial y académico de posgrado.', tags: ['cargo','asesor'],
      history: [ ver('1.0','2025-04-14','andrea','Versión 1'), ], related: ['d22'] },

    // ---- Pruebas Saber
    { id: 'd26', area: 'psb', type: 'procedimiento', documentNumber: 'PSB-PR-001', name: 'Inscripción a Pruebas Saber Pro',
      version: '3.1', state: 'publicado', created: '2022-03-30', updated: '2025-10-09', owner: 'julian', vigencia: '2026-10-09', fav: true, views: 489,
      desc: 'Proceso de inscripción institucional de estudiantes a las Pruebas Saber Pro ante el ICFES.', tags: ['saber','inscripción','icfes'],
      history: [ ver('3.1','2025-10-09','julian','Ajuste de fechas ICFES 2025'), ver('3.0','2024-08-01','julian','Versión 3'), ver('1.0','2022-03-30','julian','Creación') ], related: ['d27','d28','d29'] },
    { id: 'd27', area: 'psb', type: 'ans', documentNumber: 'PSB-ANS-002', name: 'ANS — Reporte de resultados Saber',
      version: '1.1', state: 'aprobado', created: '2024-02-12', updated: '2025-09-19', owner: 'julian', vigencia: '2026-09-19', fav: false, views: 201, ans: 'a05',
      desc: 'Compromisos de entrega y publicación de resultados de las Pruebas Saber a programas y estudiantes.', tags: ['ans','resultados','reporte'],
      history: [ ver('1.1','2025-09-19','julian','Versión 1.1'), ver('1.0','2024-02-12','julian','Creación') ], related: ['d26'] },
    { id: 'd28', area: 'psb', type: 'manual_app', documentNumber: 'PSB-MA-003', name: 'Manual de aplicación — Plataforma de Simulacros Saber',
      version: '2.0', state: 'publicado', created: '2023-08-15', updated: '2025-12-20', owner: 'felipe', vigencia: '2026-12-20', fav: false, views: 276, app: 'ap03',
      desc: 'Manual de la plataforma de simulacros para preparación de Pruebas Saber.', tags: ['simulacros','plataforma','manual'],
      history: [ ver('2.0','2025-12-20','felipe','Versión 2'), ver('1.0','2023-08-15','felipe','Creación') ], related: ['d26'] },
    { id: 'd29', area: 'psb', type: 'guia', documentNumber: 'PSB-GU-001', name: 'Guía de preparación institucional Saber',
      version: '1.3', state: 'revision', created: '2024-05-20', updated: '2026-02-12', owner: 'julian', vigencia: '2027-02-12', fav: false, views: 203,
      desc: 'Lineamientos para acompañar la preparación de los estudiantes a las Pruebas Saber.', tags: ['guía','preparación'],
      history: [ ver('1.3','2026-02-12','julian','Revisión de contenidos 2026'), ver('1.0','2024-05-20','julian','Creación') ], related: ['d26'] },
    { id: 'd30', area: 'psb', type: 'formato', documentNumber: 'PSB-FT-004', name: 'Formato de novedades de inscripción',
      version: '1.0', state: 'vencido', created: '2023-04-04', updated: '2024-04-04', owner: 'julian', vigencia: '2025-04-04', fav: false, views: 88,
      desc: 'Formato para reportar novedades en el proceso de inscripción Saber.', tags: ['formato','novedades'],
      history: [ ver('1.0','2024-04-04','julian','Versión 1') ], related: ['d26'] },
  ];

  // ANS detallados
  const ANS = {
    a01: { docId: 'd07', name: 'Convenios de práctica con empresas aliadas', cliente: 'Programas académicos / Estudiantes en práctica', proveedor: 'Área de Prácticas — Operaciones',
      objetivo: 'Garantizar la gestión oportuna y la legalización de convenios de práctica con empresas aliadas.',
      alcance: 'Aplica a todas las solicitudes de convenio de práctica de programas de pregrado y tecnología.',
      canales: ['Correo: practicas@institucion.edu.co', 'Mesa de ayuda interna', 'Portal de Prácticas'],
      horario: 'Lunes a viernes, 7:00 a.m. – 5:00 p.m.',
      tResp: '2 días hábiles', tResol: '8 días hábiles (convenio nuevo) / 3 días (renovación)',
      responsables: ['Coordinador de prácticas', 'Líder de Prácticas'],
      restricciones: ['No aplica a convenios internacionales (gestionados por RRII)', 'Sujeto a disponibilidad de cupos de la empresa'],
      causales: ['Documentación incompleta de la empresa', 'Empresa sin cámara de comercio vigente', 'Objeto social no compatible con el programa'],
      compromisos: ['El área responde en los tiempos pactados', 'El estudiante radica documentación completa', 'La empresa designa un tutor'] },
    a02: { docId: 'd12', name: 'Respuesta a solicitudes de homologación', cliente: 'Estudiantes nuevos y de transferencia', proveedor: 'Área de Homologaciones — Operaciones',
      objetivo: 'Asegurar la respuesta oportuna y trazable a las solicitudes de homologación de asignaturas.',
      alcance: 'Solicitudes de homologación de pregrado provenientes de otras IES o programas internos.',
      canales: ['Sistema SIHO', 'Correo: homologaciones@institucion.edu.co'],
      horario: 'Lunes a viernes, 8:00 a.m. – 6:00 p.m.',
      tResp: '1 día hábil', tResol: '5 días hábiles',
      responsables: ['Analista de homologaciones', 'Líder de Homologaciones'],
      restricciones: ['No aplica a programas en convenio', 'Máximo 50% de créditos homologables'],
      causales: ['Contenidos programáticos sin sello institucional', 'Asignatura con calificación inferior a 3.0', 'Documentación ilegible'],
      compromisos: ['Respuesta dentro del ANS', 'Notificación automática del resultado', 'El estudiante aporta contenidos certificados'] },
    a03: { docId: 'd19', name: 'Atención a novedades de matrícula', cliente: 'Estudiantes de pregrado', proveedor: 'Operación Académica de Pregrado',
      objetivo: 'Resolver oportunamente las novedades de matrícula que afecten la vida académica del estudiante.',
      alcance: 'Adiciones, cancelaciones, cambios de grupo y correcciones de matrícula.',
      canales: ['Portal del estudiante', 'Correo institucional', 'Línea de atención'],
      horario: 'Lunes a sábado, 7:00 a.m. – 8:00 p.m.',
      tResp: '4 horas hábiles', tResol: '2 días hábiles',
      responsables: ['Coordinador académico de pregrado'],
      restricciones: ['Sujeto al calendario académico', 'No aplica fuera de fechas de matrícula'],
      causales: ['Solicitud fuera de calendario', 'Estudiante con bloqueo financiero'],
      compromisos: ['Atención dentro del ANS', 'Trazabilidad en el sistema', 'El estudiante reporta con su usuario institucional'] },
    a04: { docId: 'd24', name: 'Gestión de cohortes de posgrado', cliente: 'Aspirantes y estudiantes de posgrado', proveedor: 'Operación Académica de Posgrado',
      objetivo: 'Definir tiempos de apertura, confirmación y gestión de cohortes de posgrado. (Borrador)',
      alcance: 'Especializaciones y maestrías.',
      canales: ['Correo: posgrados@institucion.edu.co'],
      horario: 'Lunes a viernes, 8:00 a.m. – 5:00 p.m.',
      tResp: '1 día hábil', tResol: 'Por definir',
      responsables: ['Coordinador de posgrado'],
      restricciones: ['Mínimo de estudiantes por cohorte'],
      causales: ['Cohorte sin mínimo de inscritos'],
      compromisos: ['(En definición)'] },
    a05: { docId: 'd27', name: 'Reporte de resultados Saber', cliente: 'Programas académicos y estudiantes', proveedor: 'Área de Pruebas Saber',
      objetivo: 'Entregar y publicar los resultados de las Pruebas Saber de forma oportuna y confiable.',
      alcance: 'Resultados Saber Pro y Saber TyT a nivel institucional.',
      canales: ['Informe institucional', 'Correo a directores de programa'],
      horario: 'Según calendario ICFES',
      tResp: '3 días hábiles tras publicación ICFES', tResol: '10 días hábiles (informe consolidado)',
      responsables: ['Líder de Pruebas Saber'],
      restricciones: ['Sujeto a publicación oficial del ICFES'],
      causales: ['Resultados no publicados por ICFES', 'Inconsistencias en el reporte oficial'],
      compromisos: ['Entrega del informe en el plazo', 'Confidencialidad de datos', 'Acompañamiento a programas'] },
  };

  // Cargos (manual de funciones / descriptores)
  const CARGOS = {
    c01: { docId: 'd02', name: 'Diseñador instruccional', area: 'fco', jefe: 'Líder Fábrica de Contenidos', nivel: 'Profesional',
      objetivo: 'Diseñar experiencias de aprendizaje efectivas traduciendo contenidos disciplinares en recursos educativos digitales.',
      generales: ['Diseñar la estructura pedagógica de los cursos', 'Acompañar a los expertos temáticos', 'Asegurar la calidad pedagógica del contenido'],
      especificas: ['Elaborar guiones y storyboards', 'Definir actividades y evaluaciones', 'Aplicar principios de diseño instruccional (ADDIE)', 'Verificar accesibilidad de los recursos'],
      responsabilidades: ['Calidad pedagógica de los OVA', 'Cumplimiento de cronogramas de producción'],
      tecnicas: ['Diseño instruccional', 'Herramientas de autoría (Articulate, H5P)', 'LMS', 'Modelos ADDIE / SAM'],
      blandas: ['Comunicación', 'Trabajo en equipo', 'Pensamiento creativo', 'Orientación al detalle'],
      kpis: ['OVA producidos a tiempo', 'Índice de calidad pedagógica', 'Satisfacción del experto temático'],
      herramientas: ['Articulate 360', 'Figma', 'LMS institucional', 'Suite Office 365'],
      perfil: 'Profesional en educación, comunicación o afines con experiencia en e-learning (mín. 2 años).',
      relaciones: ['Productor multimedia', 'Experto temático', 'Líder de Fábrica de Contenidos'], docs: ['d01','d03'] },
    c02: { docId: 'd03', name: 'Productor multimedia', area: 'fco', jefe: 'Líder Fábrica de Contenidos', nivel: 'Profesional',
      objetivo: 'Producir piezas audiovisuales y multimedia de alta calidad para los recursos educativos.',
      generales: ['Producir video, audio y animación', 'Asegurar calidad técnica de las piezas'],
      especificas: ['Edición de video', 'Animación 2D', 'Diseño gráfico', 'Postproducción de audio'],
      responsabilidades: ['Calidad técnica de las piezas', 'Cumplimiento de la guía de estilo'],
      tecnicas: ['Adobe Premiere / After Effects', 'Diseño gráfico', 'Animación', 'Audio'],
      blandas: ['Creatividad', 'Gestión del tiempo', 'Trabajo en equipo'],
      kpis: ['Piezas entregadas a tiempo', 'Cumplimiento de guía de estilo'],
      herramientas: ['Adobe Creative Cloud', 'Cámaras y equipos de estudio'],
      perfil: 'Profesional o técnico en producción audiovisual con portafolio demostrable.',
      relaciones: ['Diseñador instruccional', 'Líder de Fábrica de Contenidos'], docs: ['d04'] },
    c03: { docId: 'd08', name: 'Coordinador de prácticas', area: 'pra', jefe: 'Líder de Prácticas', nivel: 'Coordinación',
      objetivo: 'Coordinar la gestión, legalización y seguimiento de las prácticas profesionales.',
      generales: ['Gestionar convenios', 'Coordinar tutores', 'Hacer seguimiento a practicantes'],
      especificas: ['Validar documentación de convenios', 'Asignar tutores', 'Reportar novedades de práctica'],
      responsabilidades: ['Cumplimiento del ANS de convenios', 'Bienestar del practicante'],
      tecnicas: ['Gestión de convenios', 'Normativa de prácticas', 'Manejo de sistemas internos'],
      blandas: ['Negociación', 'Comunicación', 'Organización'],
      kpis: ['Convenios legalizados', 'Cumplimiento de ANS', 'Practicantes con tutor asignado'],
      herramientas: ['Portal de Prácticas', 'Office 365'],
      perfil: 'Profesional en áreas administrativas o afines, 3 años de experiencia.',
      relaciones: ['Empresas aliadas', 'Tutores', 'Estudiantes'], docs: ['d06','d07'] },
    c04: { docId: 'd13', name: 'Analista de homologaciones', area: 'hom', jefe: 'Líder de Homologaciones', nivel: 'Profesional',
      objetivo: 'Analizar y dictaminar las solicitudes de homologación con criterios académicos.',
      generales: ['Evaluar contenidos programáticos', 'Dictaminar equivalencias', 'Registrar resultados en SIHO'],
      especificas: ['Comparar contenidos y créditos', 'Aplicar criterios de equivalencia', 'Gestionar el sistema SIHO'],
      responsabilidades: ['Trazabilidad de las decisiones', 'Cumplimiento del ANS de homologaciones'],
      tecnicas: ['Análisis curricular', 'Sistema SIHO', 'Normativa académica'],
      blandas: ['Análisis', 'Atención al detalle', 'Objetividad'],
      kpis: ['Solicitudes resueltas en ANS', 'Tasa de reproceso', 'Exactitud del dictamen'],
      herramientas: ['SIHO', 'Office 365'],
      perfil: 'Profesional con conocimiento de planes de estudio, 2 años de experiencia.',
      relaciones: ['Estudiantes', 'Directores de programa'], docs: ['d11','d14'] },
    c05: { docId: 'd18', name: 'Coordinador académico de pregrado', area: 'oap', jefe: 'Líder Op. Pregrado', nivel: 'Coordinación',
      objetivo: 'Coordinar la programación y operación académica de los programas de pregrado.',
      generales: ['Coordinar programación académica', 'Gestionar novedades de matrícula', 'Apoyar a directores de programa'],
      especificas: ['Definir oferta y horarios', 'Asignar docentes', 'Resolver novedades de matrícula'],
      responsabilidades: ['Cumplimiento de calendario académico', 'Cumplimiento del ANS de novedades'],
      tecnicas: ['Programación académica', 'Sistemas académicos', 'Análisis de datos'],
      blandas: ['Liderazgo', 'Planeación', 'Resolución de problemas'],
      kpis: ['Grupos abiertos a tiempo', 'Novedades resueltas en ANS', 'Ocupación de grupos'],
      herramientas: ['Portal de Programación', 'SIA', 'Office 365'],
      perfil: 'Profesional con experiencia en gestión académica, 3 años.',
      relaciones: ['Directores de programa', 'Docentes', 'Estudiantes'], docs: ['d17','d19','d20'] },
    c06: { docId: 'd23', name: 'Coordinador de posgrado', area: 'opg', jefe: 'Líder Op. Posgrado', nivel: 'Coordinación',
      objetivo: 'Coordinar la operación académica de los programas de posgrado por cohortes.',
      generales: ['Gestionar cohortes', 'Coordinar matrícula de posgrado', 'Acompañar a estudiantes'],
      especificas: ['Aperturar cohortes', 'Gestionar matrículas', 'Coordinar docentes invitados'],
      responsabilidades: ['Viabilidad de las cohortes', 'Experiencia del estudiante de posgrado'],
      tecnicas: ['Gestión académica de posgrado', 'Sistemas académicos'],
      blandas: ['Relacionamiento', 'Organización', 'Comunicación'],
      kpis: ['Cohortes abiertas', 'Retención de estudiantes', 'Satisfacción'],
      herramientas: ['SIA', 'CRM', 'Office 365'],
      perfil: 'Profesional con posgrado y experiencia en gestión académica.',
      relaciones: ['Aspirantes', 'Docentes', 'Directores de posgrado'], docs: ['d22','d24'] },
    c07: { docId: 'd25', name: 'Asesor de posgrado', area: 'opg', jefe: 'Coordinador de posgrado', nivel: 'Profesional',
      objetivo: 'Asesorar a los aspirantes en el proceso de admisión y matrícula de posgrado.',
      generales: ['Asesorar aspirantes', 'Gestionar leads', 'Apoyar la matrícula'],
      especificas: ['Atender solicitudes de información', 'Hacer seguimiento de aspirantes', 'Apoyar el cierre de matrícula'],
      responsabilidades: ['Conversión de aspirantes', 'Calidad de la asesoría'],
      tecnicas: ['Asesoría comercial', 'CRM', 'Oferta de posgrados'],
      blandas: ['Comunicación', 'Persuasión', 'Servicio'],
      kpis: ['Tasa de conversión', 'Aspirantes atendidos', 'Satisfacción'],
      herramientas: ['CRM', 'Office 365'],
      perfil: 'Profesional con experiencia en asesoría comercial o académica.',
      relaciones: ['Aspirantes', 'Coordinador de posgrado'], docs: ['d22'] },
  };

  // Aplicaciones
  const APPS = {
    ap01: { docId: 'd14', name: 'SIHO — Sistema Interno de Homologaciones', area: 'hom', estado: 'Producción',
      objetivo: 'Gestionar de forma trazable las solicitudes de homologación de asignaturas.',
      flujos: ['Radicación de solicitud', 'Análisis curricular', 'Dictamen', 'Notificación al estudiante', 'Reportes'],
      roles: ['Estudiante (radica)', 'Analista (dictamina)', 'Líder (aprueba)', 'Auditor (consulta)'],
      faqs: [ { q: '¿Cuánto tarda una homologación?', a: 'Hasta 5 días hábiles según el ANS HOM-ANS-002.' }, { q: '¿Puedo homologar prácticas?', a: 'No, las prácticas no son homologables.' } ],
      respFunc: 'Diana Marcela Ruiz', respTec: 'Felipe Arango Mesa', ans: 'a02', manualUser: 'd14',
      versionApp: 'v2.3.0', usuarios: 1240 },
    ap02: { docId: 'd20', name: 'Portal de Programación Académica', area: 'oap', estado: 'Producción',
      objetivo: 'Planear y gestionar la oferta, horarios y asignación docente por periodo.',
      flujos: ['Definición de oferta', 'Asignación docente', 'Generación de horarios', 'Apertura de grupos'],
      roles: ['Coordinador (planea)', 'Director de programa (valida)', 'Docente (consulta)'],
      faqs: [ { q: '¿Cómo abro un grupo nuevo?', a: 'Consulta el instructivo OAP-IN-008.' } ],
      respFunc: 'Carlos Andrés Gómez', respTec: 'Felipe Arango Mesa', ans: 'a03', manualUser: 'd20',
      versionApp: 'v1.5.0-rc', usuarios: 320 },
    ap03: { docId: 'd28', name: 'Plataforma de Simulacros Saber', area: 'psb', estado: 'Producción',
      objetivo: 'Ofrecer simulacros de Pruebas Saber para la preparación de los estudiantes.',
      flujos: ['Configuración de simulacro', 'Presentación del estudiante', 'Calificación automática', 'Reporte de resultados'],
      roles: ['Estudiante (presenta)', 'Coordinador (configura)', 'Docente (analiza)'],
      faqs: [ { q: '¿Los simulacros son obligatorios?', a: 'Depende del programa; consultar guía PSB-GU-001.' } ],
      respFunc: 'Julián Ospina Vélez', respTec: 'Felipe Arango Mesa', ans: 'a05', manualUser: 'd28',
      versionApp: 'v2.0.1', usuarios: 2870 },
    ap04: { docId: null, name: 'Banco de Evidencias Operativas', area: 'fco', estado: 'En desarrollo',
      objetivo: 'Centralizar las evidencias documentales de los procesos operativos. (En construcción)',
      flujos: ['Carga de evidencia', 'Clasificación', 'Consulta'],
      roles: ['Editor', 'Consultor'],
      faqs: [],
      respFunc: 'Laura Restrepo Mejía', respTec: 'Felipe Arango Mesa', ans: null, manualUser: null,
      versionApp: 'v0.4.0-alpha', usuarios: 18 },
  };

  // Usuarios y roles
  const ROLES = [
    { id: 'admin', name: 'Administrador general', desc: 'Control total de la plataforma, configuración y usuarios.', perms: { crear:true, editar:true, aprobar:true, publicar:true, archivar:true, consultar:true, descargar:true, administrar:true } },
    { id: 'lider', name: 'Líder de área', desc: 'Gestiona y aprueba los documentos de su área.', perms: { crear:true, editar:true, aprobar:true, publicar:true, archivar:true, consultar:true, descargar:true, administrar:false } },
    { id: 'editor', name: 'Editor documental', desc: 'Crea y edita documentos; los envía a revisión.', perms: { crear:true, editar:true, aprobar:false, publicar:false, archivar:false, consultar:true, descargar:true, administrar:false } },
    { id: 'revisor', name: 'Revisor', desc: 'Revisa documentos y devuelve observaciones.', perms: { crear:false, editar:false, aprobar:false, publicar:false, archivar:false, consultar:true, descargar:true, administrar:false } },
    { id: 'aprobador', name: 'Aprobador', desc: 'Aprueba documentos revisados para su publicación.', perms: { crear:false, editar:false, aprobar:true, publicar:true, archivar:false, consultar:true, descargar:true, administrar:false } },
    { id: 'consultor', name: 'Usuario consultor', desc: 'Consulta y descarga documentos publicados.', perms: { crear:false, editar:false, aprobar:false, publicar:false, archivar:false, consultar:true, descargar:true, administrar:false } },
    { id: 'auditor', name: 'Auditor / lector institucional', desc: 'Lectura y trazabilidad sin descarga.', perms: { crear:false, editar:false, aprobar:false, publicar:false, archivar:false, consultar:true, descargar:false, administrar:false } },
  ];

  const USERS = [
    { id: 'u1', name: 'María Fernanda López', email: 'mlopez@institucion.edu.co', role: 'admin', area: null, status: 'Activo', last: '2026-06-10' },
    { id: 'u2', name: 'Laura Restrepo Mejía', email: 'lrestrepo@institucion.edu.co', role: 'lider', area: 'fco', status: 'Activo', last: '2026-06-10' },
    { id: 'u3', name: 'Mauricio Salazar Ríos', email: 'msalazar@institucion.edu.co', role: 'lider', area: 'pra', status: 'Activo', last: '2026-06-09' },
    { id: 'u4', name: 'Diana Marcela Ruiz', email: 'druiz@institucion.edu.co', role: 'lider', area: 'hom', status: 'Activo', last: '2026-06-11' },
    { id: 'u5', name: 'Carlos Andrés Gómez', email: 'cgomez@institucion.edu.co', role: 'lider', area: 'oap', status: 'Activo', last: '2026-06-08' },
    { id: 'u6', name: 'Andrea Forero Castro', email: 'aforero@institucion.edu.co', role: 'lider', area: 'opg', status: 'Activo', last: '2026-06-05' },
    { id: 'u7', name: 'Julián Ospina Vélez', email: 'jospina@institucion.edu.co', role: 'lider', area: 'psb', status: 'Activo', last: '2026-06-10' },
    { id: 'u8', name: 'Paula Rendón Loaiza', email: 'prendon@institucion.edu.co', role: 'editor', area: 'fco', status: 'Activo', last: '2026-06-11' },
    { id: 'u9', name: 'Sebastián Cárdenas', email: 'scardenas@institucion.edu.co', role: 'editor', area: 'hom', status: 'Activo', last: '2026-06-09' },
    { id: 'u10', name: 'Valentina Ríos Tamayo', email: 'vrios@institucion.edu.co', role: 'editor', area: 'oap', status: 'Activo', last: '2026-06-07' },
    { id: 'u11', name: 'Felipe Arango Mesa', email: 'farango@institucion.edu.co', role: 'editor', area: 'fco', status: 'Activo', last: '2026-06-11' },
    { id: 'u12', name: 'Rectoría — Lectura', email: 'auditoria@institucion.edu.co', role: 'auditor', area: null, status: 'Activo', last: '2026-05-30' },
    { id: 'u13', name: 'Comité de Calidad', email: 'calidad@institucion.edu.co', role: 'aprobador', area: null, status: 'Activo', last: '2026-06-04' },
    { id: 'u14', name: 'Andrés Pinto (revisor)', email: 'apinto@institucion.edu.co', role: 'revisor', area: 'pra', status: 'Inactivo', last: '2026-03-12' },
  ];

  // Solicitudes en flujo de revisión/aprobación
  const WORKFLOW = [
    { id: 'w1', docId: 'd15', stage: 'aprobacion', assignee: 'Vicerrectoría Académica', since: '2026-02-22', priority: 'alta' },
    { id: 'w2', docId: 'd04', stage: 'revision', assignee: 'Comité de marca', since: '2026-01-15', priority: 'media' },
    { id: 'w3', docId: 'd20', stage: 'revision', assignee: 'Carlos Andrés Gómez', since: '2026-02-05', priority: 'media' },
    { id: 'w4', docId: 'd29', stage: 'revision', assignee: 'Julián Ospina Vélez', since: '2026-02-12', priority: 'baja' },
    { id: 'w5', docId: 'd16', stage: 'creacion', assignee: 'Sebastián Cárdenas', since: '2026-02-18', priority: 'baja' },
    { id: 'w6', docId: 'd24', stage: 'creacion', assignee: 'Andrea Forero Castro', since: '2026-02-20', priority: 'media' },
  ];

  // Actividad reciente
  const ACTIVITY = [
    { who: 'paula', action: 'actualizó a v3.2', docId: 'd01', when: 'Hace 2 horas' },
    { who: 'diana', action: 'publicó v5.1 de', docId: 'd11', when: 'Hace 1 día' },
    { who: 'andrea', action: 'creó el borrador de', docId: 'd24', when: 'Hace 2 días' },
    { who: 'julian', action: 'envió a revisión', docId: 'd29', when: 'Hace 3 días' },
    { who: 'felipe', action: 'actualizó el manual de', docId: 'd14', when: 'Hace 4 días' },
    { who: 'carlos', action: 'aprobó v2.1 de', docId: 'd18', when: 'Hace 5 días' },
  ];

const AREA_IDS = { fco: 1, pra: 2, hom: 3, oap: 4, opg: 5, psb: 6 };
const TYPE_IDS = {
  procedimiento: 1,
  manual_funciones: 2,
  descriptor: 3,
  manual_app: 4,
  ans: 5,
  formato: 6,
  instructivo: 7,
  guia: 8,
  politica: 9,
};
const ROLE_IDS = { admin: 1, lider: 2, editor: 3, revisor: 4, aprobador: 5, consultor: 6, auditor: 7 };
const PERSON_SLUGS = ['laura', 'mauricio', 'diana', 'carlos', 'andrea', 'julian', 'paula', 'sebastian', 'valentina', 'felipe'];
const PERSON_IDS = Object.fromEntries(PERSON_SLUGS.map((slug, i) => [slug, i + 1]));

function numericDocId(id) {
  if (typeof id === 'number') return id;
  const n = Number(String(id || '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : id;
}

const AREAS_VIEW = AREAS.map(a => ({
  id: AREA_IDS[a.id],
  name: a.name,
  abbreviation: a.abbreviation,
  color: a.color,
  lead: a.lead,
}));
const TYPES_VIEW = TYPES.map(t => ({
  id: TYPE_IDS[t.id],
  name: t.name,
  abbreviation: t.abbreviation,
  icon: t.icon,
}));
const ROLES_VIEW = ROLES.map(r => ({
  id: ROLE_IDS[r.id],
  name: r.name,
  desc: r.desc,
  perms: r.perms,
}));
const DOCS_VIEW = DOCS.map(d => ({
  ...d,
  id: numericDocId(d.id),
  area: AREA_IDS[d.area],
  type: TYPE_IDS[d.type],
  owner: PERSON_IDS[d.owner],
  documentNumber: d.documentNumber,
  related: (d.related || []).map(numericDocId),
  history: (d.history || []).map(h => ({ ...h, by: PERSON_IDS[h.by] || h.by })),
}));

function areaById(id) {
  const numeric = AREA_IDS[id] || Number(id);
  return AREAS_VIEW.find(a => a.id === numeric);
}

function typeById(id) {
  const numeric = TYPE_IDS[id] || Number(id);
  return TYPES_VIEW.find(t => t.id === numeric);
}

function personById(id) {
  const numeric = PERSON_IDS[id] || Number(id);
  const slug = PERSON_SLUGS[numeric - 1];
  const person = PEOPLE[slug];
  return person ? { ...person, id: PERSON_IDS[slug], area: AREA_IDS[person.area] } : undefined;
}

function roleById(id) {
  const numeric = ROLE_IDS[id] || Number(id);
  return ROLES_VIEW.find(r => r.id === numeric);
}

export const DATA = {
  AREAS: AREAS_VIEW, TYPES: TYPES_VIEW, STATES, PEOPLE, DOCS: DOCS_VIEW, ANS, CARGOS, APPS, ROLES: ROLES_VIEW, USERS, WORKFLOW, ACTIVITY,
  areaById,
  typeById,
  docById: (id) => DOCS_VIEW.find(d => d.id === numericDocId(id)),
  personById,
  roleById,
  fmtDate: (s) => {
    if (!s || s === '—') return '—';
    const [y, m, d] = s.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
  },
};
