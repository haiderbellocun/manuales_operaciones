import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileStorage } from '../store/files.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { getArea, getType } from '../db/repos/catalog.js';
import { logActivity } from '../db/repos/catalog.js';
import { notifyUsers } from '../db/repos/notifications.js';
import { findDocumentOwnerRecipient } from '../db/repos/users.js';
import {
  listDocuments, getDocument, createDocument, toggleFavorite,
  incrementViews, createUpdateRequest, getFileMeta, upsertFile,
  getVersionFileMeta, updateDocument,
  addWorkflowItem, resolveRevisorName, assertCanCreateInArea,
  assertCanEditInArea, createDocumentVersion,
} from '../db/repos/documents.js';

const router = Router();
router.use(authRequired);

async function notifySafely(recipients, payload) {
  try {
    return await notifyUsers(recipients, payload);
  } catch (err) {
    console.error('No se pudo crear/enviar notificacion:', err.message);
    return [];
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
    fields: 20,
    fieldNameSize: 80,
    fieldSize: 10 * 1024,
  },
  fileFilter: (_req, file, cb) => {
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

router.get('/', requirePermission('consultar'), async (req, res, next) => {
  try {
    const { area, type, state, search, page, limit } = req.query;
    res.json(await listDocuments(req.auth, { area, type, state, search, page, limit }));
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

router.get('/:id/file', requirePermission('descargar'), async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.auth);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const meta = await getFileMeta(req.params.id);
    if (!meta?.storedName) {
      return res.status(404).json({ message: 'Este documento no tiene archivo adjunto.' });
    }
    if (!(await fileStorage.exists(meta.storedName))) {
      return res.status(404).json({ message: 'Archivo no encontrado en Cloud Storage.' });
    }
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.originalName)}"`);
    await logActivity(req.auth.id, 'Descargo archivo vigente del documento', doc.id, {
      eventType: 'file_downloaded',
      details: { version: doc.version, originalName: meta.originalName, storedName: meta.storedName },
    });
    fileStorage.stream(meta.storedName).pipe(res);
  } catch (err) {
    next(err);
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
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.originalName || `${doc.documentNumber}-v${meta.version}`)}"`);
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
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Error al subir archivo.' });
    let storedName;
    try {
      const doc = await getDocument(req.params.id, req.auth);
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      assertCanEditInArea(req.auth, doc.area);
      if (!req.file) return res.status(400).json({ message: 'El archivo de la nueva version es obligatorio.' });

      const version = String(req.body?.version || '').trim();
      storedName = await fileStorage.save(doc.id, doc.documentNumber, version, req.file);
      const updated = await createDocumentVersion(doc, req.body || {}, req.file, storedName, req.auth);
      const owner = await findDocumentOwnerRecipient(doc.owner, doc.area);
      await notifySafely([owner?.id], {
        title: 'Nueva version documental',
        message: `${req.auth.email} creo la version ${version} de "${doc.name}".`,
        type: 'workflow',
        docId: doc.id,
      });
      res.status(201).json(updated);
    } catch (e) {
      if (storedName) await fileStorage.remove(storedName).catch(() => {});
      res.status(e.statusCode || 500).json({ message: e.message || 'Error al crear la nueva version.' });
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

router.post('/', requirePermission('crear'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    const { type, area, name, owner } = payload;
    if (!type || !area || !name || !owner) {
      return res.status(400).json({ message: 'Tipo, area, nombre y responsable son obligatorios.' });
    }
    assertCanCreateInArea(req.auth, area);
    const areaObj = await getArea(area);
    const typeObj = await getType(type);
    if (!areaObj || !typeObj) {
      return res.status(400).json({ message: 'Area o tipo documental invalido.' });
    }
    const newDoc = await createDocument(
      { ...payload, userId: req.user.sub },
      areaObj,
      typeObj,
    );
    const revisorName = await resolveRevisorName(payload.revisor);
    await addWorkflowItem(newDoc.id, revisorName, payload.revisor, payload.aprobador);
    await notifySafely([payload.revisor], {
      title: 'Nuevo documento para revision',
      message: `${req.user.email} cargo "${newDoc.name}" y te asigno la revision.`,
      type: 'workflow',
      docId: newDoc.id,
    });
    res.status(201).json(newDoc);
  } catch (err) {
    next(err);
  }
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
    const views = await incrementViews(doc.id);
    res.json({ views });
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
    if (err) return res.status(400).json({ message: err.message || 'Error al subir archivo.' });
    try {
      const routeDocId = Number(req.params.id);
      const doc = await getDocument(routeDocId, req.auth);
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      assertCanCreateInArea(req.auth, doc.area);
      if (Number(doc.id) !== routeDocId) {
        return res.status(409).json({ message: 'El documento consultado no coincide con el id de la ruta.' });
      }
      if (!req.file) return res.status(400).json({ message: 'No se recibio ningun archivo.' });

      const prev = await getFileMeta(doc.id);
      const storedName = await fileStorage.save(routeDocId, doc.documentNumber, doc.version, req.file);
      const meta = await upsertFile(doc.id, req.file, req.user.sub, storedName);
      if (prev?.storedName && prev.storedName !== storedName) {
        await fileStorage.remove(prev.storedName);
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
      console.error(e);
      res.status(e.statusCode || 500).json({ message: e.message || 'Error al guardar archivo.' });
    }
  });
});

export default router;
