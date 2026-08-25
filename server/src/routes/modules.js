import { Router } from 'express';
import { authRequired, requirePermission } from '../middleware/auth.js';
import {
  listAns, getAns, listCargos, getCargo, listApps, getApp,
} from '../db/repos/modules.js';

const router = Router();
router.use(authRequired);

router.get('/modules/ans', requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await listAns(req.auth));
  } catch (err) {
    next(err);
  }
});

router.get('/modules/ans/:id', requirePermission('consultar'), async (req, res, next) => {
  try {
    const item = await getAns(req.auth, req.params.id);
    if (!item) return res.status(404).json({ message: 'ANS no encontrado.' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.get('/modules/cargos', requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await listCargos(req.auth));
  } catch (err) {
    next(err);
  }
});

router.get('/modules/cargos/:id', requirePermission('consultar'), async (req, res, next) => {
  try {
    const item = await getCargo(req.auth, req.params.id);
    if (!item) return res.status(404).json({ message: 'Cargo no encontrado.' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.get('/modules/apps', requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await listApps(req.auth));
  } catch (err) {
    next(err);
  }
});

router.get('/modules/apps/:id', requirePermission('consultar'), async (req, res, next) => {
  try {
    const item = await getApp(req.auth, req.params.id);
    if (!item) return res.status(404).json({ message: 'Aplicacion no encontrada.' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
