import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileStorage } from '../store/files.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { getArea, getType } from '../db/repos/catalog.js';
import { validateAreaCoordination } from '../db/areaRules.js';
import { logActivity } from '../db/repos/catalog.js';
import { notifyUsers } from '../db/repos/notifications.js';
import { recordDocumentInteraction } from '../db/repos/analytics.js';
import {
  findDocumentOwnerRecipient,
  resolveResponsiblePerson,
  validateWorkflowAssignments,
} from '../db/repos/users.js';
import {
  listDocuments, getDocument, createDocumentWithFile, toggleFavorite,
  createUpdateRequest, getFileMeta, upsertFile,
  getInfographicMeta, upsertInfographic,
  getVersionFileMeta, updateDocument,
  assertCanCreateInArea, assertCanEditInArea, createDocumentVersion, reserveDocumentId,
} from '../db/repos/documents.js';

const router = Router();
router.use(authRequired);
const OPERATION_ACADEMIC_AREA_ID = 1;
const OPERATION_ACADEMIC_FULL_ROLE_ID = 8;

async function notifySafely(recipients, payload) {
  try {
    return await notifyUsers(recipients, payload);
  } catch (err) {
    console.error('No se pudo crear/enviar notificacion:', err.message);
    return [];
  }
}

function normalizeUploadFileName(value) {
  const originalName = String(value || '').trim();
  if (!/[ÃÂâð]/.test(originalName)) return originalName;
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? originalName : decoded;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    fields: 20,
    fieldNameSize: 80,
    fieldSize: 10 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    file.originalname = normalizeUploadFileName(file.originalname);
    if (file.fieldname === 'infographic') {
      const infographicFormats = {
        '.png': ['image/png'],
        '.jpg': ['image/jpeg'],
        '.jpeg': ['image/jpeg'],
        '.webp': ['image/webp'],
      };
      const ext = path.extname(file.originalname).toLowerCase();
      if (infographicFormats[ext]?.includes(file.mimetype)) return cb(null, true);
      return cb(new Error('Formato de infografia no permitido. Usa PNG, JPG o WEBP.'));
    }
    const allowed = {
      '.pdf': ['application/pdf'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.doc': ['application/msword', 'application/octet-stream'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    };
    const ext = path.extname(file.originalname).toLowerCase();
    const acceptedMimes = allowed[ext];
    if (acceptedMimes?.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Formato no permitido. Usa PDF, DOCX o XLSX.'));
  },
});

const documentBundleUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'infographic', maxCount: 1 },
]);
const MAX_INFOGRAPHIC_SIZE = 10 * 1024 * 1024;

function uploadErrorMessage(error, fallback = 'No se pudieron recibir los archivos.') {
  const messages = {
    LIMIT_FILE_SIZE: 'Uno de los archivos supera el tamaño permitido: 25 MB para el documento y 10 MB para la infografía.',
    LIMIT_FILE_COUNT: 'Solo puedes adjuntar un archivo documental y una infografía.',
    LIMIT_UNEXPECTED_FILE: 'Se recibió un archivo adicional o un campo de archivo no permitido. Adjunta únicamente el documento y la infografía.',
    LIMIT_FIELD_COUNT: 'El formulario contiene más campos de los permitidos.',
    LIMIT_FIELD_KEY: 'Uno de los nombres de campo del formulario es demasiado largo.',
    LIMIT_FIELD_VALUE: 'Uno de los valores del formulario supera el tamaño permitido.',
    LIMIT_PART_COUNT: 'El formulario contiene demasiados elementos.',
  };
  if (messages[error?.code]) return messages[error.code];
  if (/too many files/i.test(error?.message || '')) return messages.LIMIT_FILE_COUNT;
  if (/unexpected field/i.test(error?.message || '')) return messages.LIMIT_UNEXPECTED_FILE;
  return error?.message || fallback;
}

function respondUploadError(res, error, fallback) {
  return res.status(400).json({
    code: error?.code || 'UPLOAD_ERROR',
    message: uploadErrorMessage(error, fallback),
  });
}

function operationErrorPayload(error, fallback) {
  const storageUnavailable = error?.code === 'STORAGE_UNAVAILABLE';
  return {
    ...(error?.code ? { code: error.code } : {}),
    message: storageUnavailable
      ? 'El almacenamiento de archivos no está disponible en este momento.'
      : (error?.message || fallback),
  };
}

function validateDocumentVersion(value, { defaultValue = '', required = true } = {}) {
  const version = String(value ?? '').trim() || defaultValue;
  if (required && !version) {
    const error = new Error('La version es obligatoria.');
    error.statusCode = 400;
    throw error;
  }
  if (version.length > 20) {
    const error = new Error('La version no puede superar 20 caracteres.');
    error.statusCode = 400;
    throw error;
  }
  if (/[\u0000-\u001F\u007F]/.test(version)) {
    const error = new Error('La version contiene caracteres no permitidos.');
    error.statusCode = 400;
    throw error;
  }
  return version;
}

router.get('/', requirePermission('consultar'), async (req, res, next) => {
  try {
    const { area, coordination, type, state, search, page, limit } = req.query;
    res.json(await listDocuments(req.auth, { area, coordination, type, state, search, page, limit }));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file/meta', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const meta = await getFileMeta(req.params.id);
    if (!meta) return res.status(404).json({ message: 'Sin archivo adjunto.' });
    res.json(meta);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const isPreview = req.query.mode === 'preview';
    if (!isPreview && req.auth.perms?.descargar !== true) {
      return res.status(403).json({ message: 'No tienes permisos para descargar documentos.' });
    }
    const meta = await getFileMeta(req.params.id);
    if (!meta?.storedName) {
      return res.status(404).json({ message: 'Este documento no tiene archivo adjunto.' });
    }
    if (!(await fileStorage.exists(meta.storedName))) {
      return res.status(404).json({ message: 'Archivo no encontrado en Cloud Storage.' });
    }
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${isPreview ? 'inline' : 'attachment'}; filename="${encodeURIComponent(meta.originalName)}"`,
    );
    if (!isPreview) {
      const downloadMetrics = await recordDocumentInteraction({
        docId: doc.id,
        userId: req.auth.id,
        type: 'download',
        version: doc.version,
        source: 'current_file',
        metadata: { originalName: meta.originalName, mimeType: meta.mimeType, size: meta.size },
      });
      res.setHeader('X-Document-Downloads', String(downloadMetrics.downloads));
      res.setHeader('X-Last-Downloaded-At', downloadMetrics.lastDownloadedAt || '');
      await logActivity(req.auth.id, 'Descargo archivo vigente del documento', doc.id, {
        eventType: 'file_downloaded',
        details: { version: doc.version, originalName: meta.originalName, storedName: meta.storedName },
      });
    }
    fileStorage.stream(meta.storedName).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/infographic/meta', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const meta = await getInfographicMeta(doc.id);
    if (!meta) return res.status(404).json({ message: 'Este documento no tiene infografia.' });
    const { storedName: _storedName, ...publicMeta } = meta;
    return res.json(publicMeta);
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/infographic', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const meta = await getInfographicMeta(doc.id);
    if (!meta?.storedName) {
      return res.status(404).json({ message: 'Este documento no tiene infografia.' });
    }
    if (!(await fileStorage.exists(meta.storedName))) {
      return res.status(404).json({ message: 'Infografia no encontrada en Cloud Storage.' });
    }
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('Content-Length', String(meta.size));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.originalName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300, no-transform');
    return fileStorage.stream(meta.storedName).pipe(res);
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/versions/:versionId/file', requirePermission('descargar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const meta = await getVersionFileMeta(doc.id, req.params.versionId);
    if (!meta?.storedName) {
      return res.status(404).json({ message: 'Esta version no tiene archivo adjunto.' });
    }
    if (!(await fileStorage.exists(meta.storedName))) {
      return res.status(404).json({ message: 'Archivo de version no encontrado en Cloud Storage.' });
    }
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.originalName || `${doc.documentNumber}-v${meta.version}`)}"`);
    const downloadMetrics = await recordDocumentInteraction({
      docId: doc.id,
      userId: req.auth.id,
      type: 'download',
      version: meta.version,
      source: 'version_file',
      metadata: {
        versionId: meta.id,
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        size: meta.size,
      },
    });
    res.setHeader('X-Document-Downloads', String(downloadMetrics.downloads));
    res.setHeader('X-Last-Downloaded-At', downloadMetrics.lastDownloadedAt || '');
    await logActivity(req.auth.id, `Descargo archivo de version ${meta.version}`, doc.id, {
      eventType: 'version_downloaded',
      details: { version: meta.version, versionId: meta.id, originalName: meta.originalName, storedName: meta.storedName },
    });
    fileStorage.stream(meta.storedName).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/versions', requirePermission('editar'), (req, res) => {
  documentBundleUpload(req, res, async (err) => {
    if (err) return respondUploadError(res, err, 'No se pudieron recibir los archivos de la nueva versión.');
    let storedName;
    let infographicStoredName;
    let versionCreated = false;
    try {
      const doc = await getDocument(req.params.id, req.auth);
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      assertCanEditInArea(req.auth, doc.area, doc.coordination);
      if (!['publicado', 'vencido', 'archivado'].includes(doc.state)) {
        return res.status(409).json({
          message: 'Solo puedes crear una nueva version desde un documento publicado, vencido o archivado.',
        });
      }
      const documentFile = req.files?.file?.[0];
      const infographicFile = req.files?.infographic?.[0] || null;
      if (!documentFile) return res.status(400).json({ message: 'El archivo de la nueva version es obligatorio.' });
      if (infographicFile && infographicFile.size > MAX_INFOGRAPHIC_SIZE) {
        return res.status(400).json({ message: 'La infografia no puede superar 10 MB.' });
      }

      const version = validateDocumentVersion(req.body?.version);
      if (version === String(doc.version || '').trim()) {
        return res.status(409).json({ message: 'La nueva version debe ser distinta de la version vigente.' });
      }
      const previousInfographic = infographicFile
        ? await getInfographicMeta(doc.id)
        : null;
      storedName = await fileStorage.save(doc.id, version, documentFile);
      if (infographicFile) {
        infographicStoredName = await fileStorage.saveInfographic(doc.id, version, infographicFile);
      }
      const updated = await createDocumentVersion(
        doc,
        req.body || {},
        documentFile,
        storedName,
        req.auth,
        infographicFile,
        infographicStoredName,
      );
      versionCreated = true;
      if (
        previousInfographic?.storedName
        && previousInfographic.storedName !== infographicStoredName
      ) {
        await fileStorage.remove(previousInfographic.storedName).catch(error => {
          console.error('No se pudo retirar la infografia de la version anterior:', error.message);
        });
      }
      const owner = await findDocumentOwnerRecipient(doc.owner, doc.area);
      await notifySafely([owner?.id], {
        title: 'Nueva version documental',
        message: `${req.auth.email} creo la version ${version} de "${doc.name}".`,
        type: 'workflow',
        docId: doc.id,
      });
      res.status(201).json(updated);
    } catch (e) {
      if (!versionCreated && storedName) await fileStorage.remove(storedName).catch(() => {});
      if (!versionCreated && infographicStoredName) {
        await fileStorage.remove(infographicStoredName).catch(() => {});
      }
      res.status(e.statusCode || 500).json(
        operationErrorPayload(e, 'No se pudo crear la nueva versión.'),
      );
    }
  });
});

router.put('/:id', requirePermission('editar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    res.json(await updateDocument(doc, req.body || {}, req.auth));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('crear'), (req, res) => {
  documentBundleUpload(req, res, async (uploadError) => {
    if (uploadError) {
      return respondUploadError(res, uploadError, 'No se pudieron recibir los archivos del documento.');
    }

    let storedName;
    let infographicStoredName;
    let reservedDocumentId;
    try {
      const payload = req.body || {};
      const documentFile = req.files?.file?.[0];
      const infographicFile = req.files?.infographic?.[0];
      const {
        type, area, coordination, name, revisor, aprobador,
      } = payload;
      if (!documentFile) {
        return res.status(400).json({ message: 'El archivo del documento es obligatorio.' });
      }
      if (!infographicFile) {
        return res.status(400).json({ message: 'La infografia que acompana al documento es obligatoria.' });
      }
      if (infographicFile.size > MAX_INFOGRAPHIC_SIZE) {
        return res.status(400).json({ message: 'La infografia no puede superar 10 MB.' });
      }
      if (!type || !area || !name || !revisor || !aprobador) {
        return res.status(400).json({
          message: 'Tipo, area, nombre, revisor y aprobador son obligatorios.',
        });
      }
      const initialState = String(payload.initialState || 'borrador').toLowerCase();
      if (!['borrador', 'revision'].includes(initialState)) {
        return res.status(400).json({ message: 'El estado inicial debe ser borrador o revision.' });
      }
      const version = validateDocumentVersion(payload.version, {
        defaultValue: '1.0',
        required: false,
      });

      assertCanCreateInArea(req.auth, area, coordination || null);
      const canCreateGeneralOperationAcademic = (
        Number(area) === OPERATION_ACADEMIC_AREA_ID
        && !coordination
        && (
          req.auth.perms?.administrar === true
          || Number(req.auth.role) === OPERATION_ACADEMIC_FULL_ROLE_ID
        )
      );
      const validated = await validateAreaCoordination(area, coordination || null, {
        allowGeneral: canCreateGeneralOperationAcademic,
      });
      const areaObj = validated.area;
      const coordinationObj = validated.coordination;

      const typeObj = await getType(type);
      if (!typeObj) {
        return res.status(400).json({ message: 'Tipo documental invalido.' });
      }

      const workflowAssignments = await validateWorkflowAssignments(
        revisor,
        aprobador,
        areaObj.id,
      );
      const responsiblePerson = await resolveResponsiblePerson(req.auth.id);
      reservedDocumentId = await reserveDocumentId();
      storedName = await fileStorage.save(
        reservedDocumentId,
        version,
        documentFile,
      );
      infographicStoredName = await fileStorage.saveInfographic(
        reservedDocumentId,
        version,
        infographicFile,
      );
      const newDoc = await createDocumentWithFile(
        {
          ...payload,
          version,
          reservedDocumentId,
          owner: responsiblePerson.id,
          initialState,
          userId: req.user.sub,
          userName: req.auth.name || req.user.email,
        },
        areaObj,
        typeObj,
        coordinationObj,
        documentFile,
        storedName,
        infographicFile,
        infographicStoredName,
        workflowAssignments,
      );

      if (initialState === 'revision') {
        await notifySafely([workflowAssignments.reviewer.id], {
          title: 'Nuevo documento para revision',
          message: `${req.user.email} cargo "${newDoc.name}" y te asigno la revision.`,
          type: 'workflow',
          docId: newDoc.id,
        });
      }
      return res.status(201).json(newDoc);
    } catch (err) {
      if (storedName) await fileStorage.remove(storedName).catch(() => {});
      if (infographicStoredName) await fileStorage.remove(infographicStoredName).catch(() => {});
      return res.status(err.statusCode || 500).json(
        operationErrorPayload(err, 'No se pudo crear el documento con su archivo.'),
      );
    }
  });
});

router.post('/:id/infographic', requirePermission('editar'), (req, res) => {
  upload.single('infographic')(req, res, async (uploadError) => {
    if (uploadError) {
      return respondUploadError(res, uploadError, 'No se pudo recibir la infografía.');
    }
    let newStoredName;
    let metadataSaved = false;
    try {
      const doc = await getDocument(req.params.id, req.auth);
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      assertCanEditInArea(req.auth, doc.area, doc.coordination);
      if (doc.state !== 'borrador') {
        return res.status(409).json({
          message: 'La infografia solo se puede reemplazar mientras el documento esta en Borrador.',
        });
      }
      if (!req.file) return res.status(400).json({ message: 'No se recibio ninguna infografia.' });
      if (req.file.size > MAX_INFOGRAPHIC_SIZE) {
        return res.status(400).json({ message: 'La infografia no puede superar 10 MB.' });
      }

      const previous = await getInfographicMeta(doc.id);
      newStoredName = await fileStorage.saveInfographic(doc.id, doc.version, req.file);
      const meta = await upsertInfographic(doc, req.file, req.auth.id, newStoredName);
      metadataSaved = true;
      if (previous?.storedName && previous.storedName !== newStoredName) {
        await fileStorage.remove(previous.storedName).catch(error => {
          console.error('No se pudo retirar la infografia anterior:', error.message);
        });
      }
      return res.json({ ...meta, storedName: undefined });
    } catch (err) {
      if (newStoredName && !metadataSaved) {
        await fileStorage.remove(newStoredName).catch(() => {});
      }
      return res.status(err.statusCode || 500).json(
        operationErrorPayload(err, 'No se pudo guardar la infografía.'),
      );
    }
  });
});

router.post('/:id/favorite', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    res.json(await toggleFavorite(req.user.sub, doc.id));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/view', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const metrics = await recordDocumentInteraction({
      docId: doc.id,
      userId: req.auth.id,
      type: 'view',
      version: doc.version,
      source: req.body?.source || 'document_detail',
      metadata: { state: doc.state },
    });
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update-request', requirePermission('consultar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const entry = await createUpdateRequest(
      doc.id,
      req.user.sub,
      req.body?.reason,
      req.body?.detail,
    );
    const owner = await findDocumentOwnerRecipient(doc.owner, doc.area);
    await notifySafely([owner?.id], {
      title: 'Solicitud de actualizacion',
      message: `${req.user.email} solicito actualizar "${doc.name}". Motivo: ${req.body?.reason || 'No especificado'}.`,
      type: 'update_request',
      docId: doc.id,
    });
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/file', requirePermission('crear'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return respondUploadError(res, err, 'No se pudo recibir el archivo del documento.');
    let newStoredName;
    let metadataSaved = false;
    try {
      const routeDocId = Number(req.params.id);
      const doc = await getDocument(routeDocId, req.auth);
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      assertCanCreateInArea(req.auth, doc.area, doc.coordination);
      if (doc.state !== 'borrador') {
        return res.status(409).json({
          message: 'El archivo solo se puede reemplazar mientras el documento esta en Borrador.',
        });
      }
      if (Number(doc.id) !== routeDocId) {
        return res.status(409).json({ message: 'El documento consultado no coincide con el id de la ruta.' });
      }
      if (!req.file) return res.status(400).json({ message: 'No se recibio ningun archivo.' });

      const prev = await getFileMeta(doc.id);
      newStoredName = await fileStorage.save(routeDocId, doc.version, req.file);
      const meta = await upsertFile(doc.id, req.file, req.user.sub, newStoredName);
      metadataSaved = true;
      if (prev?.storedName && prev.storedName !== newStoredName) {
        await fileStorage.remove(prev.storedName).catch(error => {
          console.error('No se pudo retirar el archivo documental anterior:', error.message);
        });
      }
      const owner = await findDocumentOwnerRecipient(doc.owner, doc.area);
      await notifySafely([owner?.id], {
        title: 'Archivo documental actualizado',
        message: `${req.user.email} subio "${req.file.originalname}" al documento "${doc.name}".`,
        type: 'file',
        docId: doc.id,
      });
      res.json(meta);
    } catch (e) {
      if (newStoredName && !metadataSaved) {
        await fileStorage.remove(newStoredName).catch(() => {});
      }
      res.status(e.statusCode || 500).json(
        operationErrorPayload(e, 'No se pudo guardar el archivo.'),
      );
    }
  });
});

export default router;
