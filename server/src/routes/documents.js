import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { paths, ensureUploadsDir } from '../store/database.js';
import { authRequired } from '../middleware/auth.js';
import { getArea, getType } from '../db/repos/catalog.js';
import {
  listDocuments, getDocument, createDocument, toggleFavorite,
  incrementViews, createUpdateRequest, getFileMeta, upsertFile,
  addWorkflowItem, resolveRevisorName,
} from '../db/repos/documents.js';

const router = Router();
router.use(authRequired);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadsDir();
      cb(null, paths.uploads);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      cb(null, `${req.params.id}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Formato no permitido. Usa PDF, DOCX o XLSX.'));
  },
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await listDocuments(req.user.sub));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file/meta', async (req, res, next) => {
  try {
    const meta = await getFileMeta(req.params.id);
    if (!meta) return res.status(404).json({ message: 'Sin archivo adjunto.' });
    res.json(meta);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file', async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.user.sub);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const meta = await getFileMeta(req.params.id);
    if (!meta?.storedName) {
      return res.status(404).json({ message: 'Este documento no tiene archivo adjunto.' });
    }
    const filePath = path.join(paths.uploads, meta.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado en el servidor.' });
    }
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.originalName)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.user.sub);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const { type, area, name } = payload;
    if (!type || !area || !name) {
      return res.status(400).json({ message: 'Tipo, área y nombre son obligatorios.' });
    }
    const areaObj = await getArea(area);
    const typeObj = await getType(type);
    if (!areaObj || !typeObj) {
      return res.status(400).json({ message: 'Área o tipo documental inválido.' });
    }
    const newDoc = await createDocument(
      { ...payload, userId: req.user.sub },
      areaObj,
      typeObj,
    );
    const revisorName = await resolveRevisorName(payload.revisor);
    await addWorkflowItem(newDoc.id, revisorName);
    res.status(201).json(newDoc);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/favorite', async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.user.sub);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    res.json(await toggleFavorite(req.user.sub, doc.id));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/view', async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.user.sub);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const views = await incrementViews(doc.id);
    res.json({ views });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update-request', async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.user.sub);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const entry = await createUpdateRequest(
      doc.id,
      req.user.sub,
      req.body?.reason,
      req.body?.detail,
    );
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/file', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Error al subir archivo.' });
    try {
      const doc = await getDocument(req.params.id, req.user.sub);
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo.' });

      const prev = await getFileMeta(doc.id);
      if (prev?.storedName) {
        const prevPath = path.join(paths.uploads, prev.storedName);
        if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
      }

      const meta = await upsertFile(doc.id, req.file, req.user.sub);
      res.json(meta);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: e.message || 'Error al guardar archivo.' });
    }
  });
});

export default router;
