# Análisis funcional preliminar — Módulo de versionamiento documental

**Proyecto:** Acervo Documental de Operaciones
**Estado del documento:** Borrador para validación con experto en gestión documental
**Tipo de entregable:** Análisis funcional; no autoriza ni contempla desarrollo de software
**Fecha:** 2026-08-04

## 1. Propósito

Definir la base funcional del futuro módulo de versionamiento documental del Acervo. El módulo deberá administrar el ciclo de vida de cada versión, conservar los archivos y metadatos históricos, controlar cuál versión es vigente y garantizar auditoría, trazabilidad y recuperación sin pérdida de información.

Este documento organiza las decisiones que deben validarse en una sesión de trabajo con el experto en gestión documental. Las definiciones marcadas como **propuesta** no se consideran aprobadas hasta recibir esa validación.

## 2. Objetivos funcionales

- Mantener varias versiones de un mismo documento sin sobrescribir el historial.
- Identificar de forma inequívoca la versión vigente, las obsoletas y las que están en elaboración.
- Aplicar revisión, aprobación y publicación a cada nueva versión.
- Registrar qué cambió, quién realizó la modificación, cuándo y por qué.
- Recuperar contenido de una versión anterior mediante un proceso controlado.
- Impedir que una versión no publicada sea visible para usuarios de consulta general.
- Conservar evidencia de todas las decisiones del flujo documental.

## 3. Fuera de alcance en esta fase

- Construcción de pantallas, API, tablas o migraciones.
- Conversión automática de formatos.
- Comparación semántica automática del contenido de archivos.
- Firma electrónica o digital.
- Integración con un sistema externo de archivo o retención.
- Definición definitiva de tablas de retención documental.

## 4. Conceptos propuestos

### 4.1 Documento lógico

Registro permanente que representa una unidad documental. Conserva un número documental estable, área, subárea, tipo, proceso, categoría y relaciones institucionales. Sus versiones cambian, pero su identidad no.

### 4.2 Versión documental

Instantánea inmutable del archivo y sus metadatos en un momento determinado. Cada versión deberá contener como mínimo:

- Identificador único.
- Número de versión.
- Archivo y huella de integridad.
- Fecha y autor de creación.
- Motivo y resumen de cambios.
- Estado de ciclo de vida.
- Revisor y aprobador asignados.
- Fechas y decisiones del flujo.
- Vigencia y fecha de publicación, cuando aplique.

### 4.3 Versión vigente

Única versión publicada que la organización reconoce como válida para consulta y uso. **Propuesta:** un documento lógico no podrá tener más de una versión vigente simultáneamente.

### 4.4 Versión obsoleta

Versión que fue vigente, pero fue reemplazada por una publicación posterior. Se conserva para auditoría y consulta histórica según permisos; nunca se elimina por la sola publicación de una versión nueva.

## 5. Modelo de numeración por validar

### Propuesta recomendada: versión mayor y menor

- `1.0`, `2.0`, `3.0`: cambio mayor de contenido, alcance, norma, estructura o responsabilidad.
- `1.1`, `1.2`, `2.1`: ajuste menor que no transforma el propósito principal.
- No se reutilizan números de versión.
- La numeración debe ser ascendente dentro del documento lógico.
- Un borrador conserva su número reservado durante el flujo.
- La corrección de un documento devuelto no crea una versión adicional; continúa sobre el mismo borrador hasta publicarse, salvo decisión contraria del experto.

### Decisiones pendientes

1. ¿La numeración será manual, sugerida por el sistema o completamente automática?
2. ¿Qué casos institucionales obligan a incrementar la versión mayor?
3. ¿Se permiten versiones con tres niveles, por ejemplo `2.1.3`?
4. ¿Los documentos importados pueden iniciar en una versión distinta de `1.0`?

## 6. Estados del ciclo de vida

| Estado | Significado | Visibilidad general | Editable |
|---|---|---:|---:|
| Borrador | Nueva versión en preparación | No | Sí, por responsables autorizados |
| En revisión | Contenido remitido al revisor | No | No, salvo devolución |
| Aprobado | Revisión superada y pendiente de publicación | No | No |
| Publicado / vigente | Versión oficial disponible | Sí | No |
| Devuelto | Requiere ajustes antes de continuar | No | Sí |
| Obsoleto | Fue vigente y quedó reemplazado | No por defecto | No |
| Archivado | Retirado del ciclo operativo por decisión autorizada | No por defecto | No |

### Regla fundamental

Solo el estado **Publicado / vigente** será visible para los usuarios generales. Aprobación y publicación son decisiones diferentes.

## 7. Flujo funcional propuesto

1. Un usuario con permiso crea una nueva versión desde un documento publicado, vencido o archivado.
2. El sistema copia los metadatos base, reserva el número de versión y crea un borrador.
3. El creador adjunta el archivo, registra el motivo y describe los cambios.
4. El creador envía la versión a revisión.
5. El revisor valida contenido y puede:
   - devolver el borrador con observaciones; o
   - marcarlo como aprobado y enviarlo al aprobador.
6. El aprobador puede:
   - devolver la versión con observaciones; o
   - publicar la versión aprobada.
7. Al publicar, el sistema realiza una operación atómica:
   - convierte la nueva versión en vigente;
   - convierte la versión vigente anterior en obsoleta;
   - registra fecha, usuario y decisión;
   - notifica a los interesados.
8. Los usuarios generales ven únicamente la nueva versión vigente.

## 8. Transiciones permitidas

| Origen | Acción | Destino | Actor esperado |
|---|---|---|---|
| Borrador | Enviar a revisión | En revisión | Creador, editor o líder autorizado |
| En revisión | Devolver | Devuelto / Borrador | Revisor asignado |
| En revisión | Aprobar revisión | Aprobado | Revisor asignado |
| Aprobado | Devolver | Devuelto / Borrador | Aprobador asignado |
| Aprobado | Publicar | Publicado / vigente | Aprobador asignado |
| Publicado | Crear nueva versión | Nuevo borrador | Editor, líder o coordinador autorizado |
| Publicado | Archivar | Archivado | Rol expresamente autorizado |
| Obsoleto | Recuperar contenido | Nuevo borrador | Rol autorizado; nunca reactiva directamente |

## 9. Historial de cambios

Cada versión deberá exigir un registro estructurado con:

- Motivo de la versión.
- Resumen ejecutivo del cambio.
- Secciones o componentes afectados.
- Tipo de cambio: mayor, menor, normativo, corrección, formato u otro.
- Referencia normativa o solicitud que originó el cambio, si aplica.
- Responsable del cambio.
- Fecha efectiva.
- Observaciones del revisor y del aprobador.

El historial deberá poder consultarse cronológicamente y distinguir cambios de archivo, metadatos y decisiones de flujo.

## 10. Recuperación de versiones anteriores

**Propuesta:** recuperar no significa volver a marcar una versión obsoleta como vigente. La recuperación deberá:

1. Seleccionar una versión histórica.
2. Crear un nuevo borrador con una nueva numeración.
3. Copiar el archivo y los metadatos seleccionados.
4. Registrar qué versión fue usada como origen y el motivo de recuperación.
5. Ejecutar nuevamente revisión, aprobación y publicación.

Esto mantiene una línea histórica continua y evita modificar evidencia previa.

## 11. Permisos propuestos

| Capacidad | Administrador | Líder de área | Editor | Revisor | Aprobador | Coordinador O. Académica | Consultor | Auditor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Consultar versión vigente | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| Crear nueva versión | Configurable | Sí, en su alcance | Sí, en su alcance | No | No | Sí, en su alcance | No | No |
| Editar borrador | Configurable | Sí | Sí | No | No | Sí | No | No |
| Revisar versión asignada | No por administración | Sí, si está asignado | No | Sí | No | Sí, si está asignado | No | No |
| Publicar versión asignada | No por administración | Sí, si está asignado | No | No | Sí | Sí, si está asignado | No | No |
| Ver versiones obsoletas | Sí | Sí, en su alcance | Según política | Según asignación | Según asignación | Sí, en su alcance | No por defecto | Sí |
| Recuperar versión | Configurable | Sí, con justificación | Según política | No | No | Sí | No | No |
| Eliminar evidencia histórica | No | No | No | No | No | No | No | No |

La matriz debe validarse con el experto y con seguridad de la información.

## 12. Auditoría y trazabilidad

El sistema futuro deberá registrar eventos inmutables para:

- Creación de versión.
- Carga o reemplazo de archivo durante borrador.
- Cambio de metadatos.
- Envío a revisión.
- Devolución y observaciones.
- Aprobación de revisión.
- Publicación.
- Obsolescencia automática de la versión anterior.
- Descarga o consulta de una versión histórica.
- Recuperación desde una versión anterior.
- Archivo del documento.

Cada evento deberá guardar usuario, rol, fecha y hora, versión, acción, estado anterior, estado nuevo, comentario, origen y datos técnicos necesarios para auditoría.

## 13. Reglas de negocio preliminares

1. Un documento lógico tendrá como máximo una versión vigente.
2. Ninguna versión podrá publicarse sin haber completado revisión y aprobación.
3. Revisor y aprobador deben pertenecer al alcance funcional definido para el área.
4. El mismo usuario podrá ocupar ambos roles únicamente si la política institucional lo permite; la decisión está pendiente.
5. Una versión publicada será inmutable.
6. Las correcciones sobre una versión publicada requieren una versión nueva.
7. No se podrá eliminar físicamente una versión con eventos de auditoría.
8. Toda nueva versión debe indicar motivo y resumen de cambios.
9. La publicación debe volver obsoleta la versión vigente anterior en la misma transacción.
10. Una versión obsoleta no será visible para consulta general ni aparecerá en búsquedas ordinarias.
11. La recuperación siempre crea un nuevo borrador y conserva la referencia de origen.
12. El acceso a versiones históricas deberá respetar área, subárea, rol y asignación.
13. La descarga de una versión histórica también deberá registrarse en las métricas y la auditoría.
14. Los archivos deben conservar una huella de integridad para detectar alteraciones.
15. Debe existir control de concurrencia para impedir que dos usuarios publiquen versiones incompatibles al mismo tiempo.

## 14. Modelo conceptual de información

### Documento

- Identidad y número documental.
- Área, subárea, tipo, categoría y proceso.
- Versión vigente.
- Estado operativo general.

### Versión

- Documento padre.
- Número y estado.
- Archivo, tamaño, tipo y huella de integridad.
- Metadatos congelados de la versión.
- Fechas de creación, revisión, aprobación, publicación y obsolescencia.
- Versión de origen, si fue recuperada.

### Cambio de versión

- Motivo, tipo, resumen y secciones afectadas.
- Usuario responsable.

### Decisión de flujo

- Etapa, actor asignado, decisión, comentario y fecha.

### Evento de auditoría

- Actor, rol, acción, estado anterior, estado posterior, fecha, versión y contexto técnico.

## 15. Requerimientos de interfaz para una fase futura

- Línea de tiempo completa de versiones.
- Identificación visible de vigente, borrador y obsoletas.
- Comparación de metadatos entre dos versiones.
- Descarga controlada de versiones históricas.
- Vista del resumen de cambios antes de aprobar.
- Acción de recuperar con confirmación y justificación obligatoria.
- Filtros por estado, versión, fecha y responsable.
- Mensajes claros cuando una versión esté bloqueada por el flujo.
- Indicador de quién tiene actualmente la responsabilidad de actuar.

## 16. Requerimientos no funcionales por validar

- Retención mínima de archivos y eventos.
- Capacidad máxima por archivo y cantidad de versiones.
- Cifrado y clasificación de información.
- Tiempo objetivo de recuperación.
- Disponibilidad y respaldo del almacenamiento.
- Integridad mediante hash y verificación periódica.
- Exportación de trazabilidad para auditoría.
- Accesibilidad de las pantallas.
- Rendimiento esperado para documentos con historiales extensos.

## 17. Preguntas para la sesión con el experto

1. ¿Cuál es la política institucional vigente para numerar versiones?
2. ¿Qué diferencia formal existe entre corrección, actualización y nueva versión?
3. ¿Se admite que revisor y aprobador sean la misma persona?
4. ¿Qué roles pueden consultar o descargar versiones obsoletas?
5. ¿Cuándo un documento debe archivarse en lugar de versionarse?
6. ¿Qué campos del documento deben congelarse dentro de cada versión?
7. ¿Qué evidencia debe conservarse de comentarios y decisiones?
8. ¿Cuál es el tiempo de retención de archivos obsoletos?
9. ¿Se requiere firma, visto bueno adicional o aprobación colegiada?
10. ¿Cómo se gestionan cambios urgentes o publicaciones excepcionales?
11. ¿Qué documentos requieren control normativo especial?
12. ¿Cómo debe tratarse una versión publicada por error?
13. ¿Qué datos deben aparecer en el cuadro de control de cambios?
14. ¿Se necesita comparar contenido de Word, PDF o Excel?
15. ¿Qué notificaciones son obligatorias y para quién?

## 18. Criterios de aceptación funcional para la fase de análisis

- El experto valida o corrige el modelo de numeración.
- Se aprueba el catálogo de estados y transiciones.
- Se aprueba la matriz de permisos.
- Se define la diferencia entre versión vigente, obsoleta y archivada.
- Se acuerda el mecanismo de recuperación.
- Se aprueba la información mínima del historial de cambios.
- Se definen retención, auditoría y trazabilidad.
- Todas las preguntas críticas quedan respondidas o registradas como decisión pendiente con responsable y fecha.

## 19. Agenda sugerida de la sesión

1. Contexto y objetivos — 10 minutos.
2. Numeración y ciclo de vida — 20 minutos.
3. Flujo, actores y excepciones — 25 minutos.
4. Historial, auditoría y recuperación — 20 minutos.
5. Permisos y visibilidad — 15 minutos.
6. Decisiones, pendientes y responsables — 10 minutos.

## 20. Resultado esperado posterior a la sesión

Una versión aprobada de este documento que pueda convertirse en historias de usuario, criterios de aceptación, modelo de datos y diseño técnico durante una fase de desarrollo independiente.
