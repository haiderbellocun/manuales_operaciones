import { Router } from 'express';
import { authRequired, requirePermission } from '../middleware/auth.js';
import {
  listAreas, listCoordinations, listTypes, listRoles, updateRole, listPeople, getStats, getReportSummary, listActivity,
} from '../db/repos/catalog.js';
import { createUser, listAssignableUsers, listUsers, updateUser } from '../db/repos/users.js';

const router = Router();

function scopedByArea(auth, items) {
  const role = Number(auth.role);
  if (auth.perms?.administrar === true || [5, 6, 7].includes(role)) return items;
  if (!auth.area) return [];
  return items.filter((item) => {
    const itemArea = Number(item.id ?? item.area);
    if (itemArea !== Number(auth.area)) return false;
    if (auth.coordination && item.coordination) {
      return Number(item.coordination) === Number(auth.coordination);
    }
    return true;
  });
}

router.get('/areas', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(scopedByArea(req.auth, await listAreas()));
  } catch (err) {
    next(err);
  }
});

router.get('/coordinations', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    const areaId = req.query.areaId || req.query.area;
    const items = await listCoordinations(areaId || null);
    if (req.auth.perms?.administrar === true || !req.auth.area) {
      return res.json(items);
    }
    if (areaId && Number(areaId) !== Number(req.auth.area)) {
      return res.json([]);
    }
    if (req.auth.coordination) {
      return res.json(items.filter(item => Number(item.id) === Number(req.auth.coordination)));
    }
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get('/types', authRequired, requirePermission('consultar'), async (_req, res, next) => {
  try {
    res.json(await listTypes());
  } catch (err) {
    next(err);
  }
});

router.get('/roles', authRequired, requirePermission('administrar'), async (_req, res, next) => {
  try {
    res.json(await listRoles());
  } catch (err) {
    next(err);
  }
});

router.put('/roles/:id', authRequired, requirePermission('administrar'), async (req, res, next) => {
  try {
    res.json(await updateRole(req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
});

router.get('/people', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(scopedByArea(req.auth, await listPeople()));
  } catch (err) {
    next(err);
  }
});

router.get('/users', authRequired, requirePermission('administrar'), async (_req, res, next) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    next(err);
  }
});

router.post('/users', authRequired, requirePermission('administrar'), async (req, res, next) => {
  try {
    res.status(201).json(await createUser(req.body || {}));
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id', authRequired, requirePermission('administrar'), async (req, res, next) => {
  try {
    res.json(await updateUser(req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
});

router.get('/assignees', authRequired, requirePermission('consultar'), async (_req, res, next) => {
  try {
    res.json(await listAssignableUsers());
  } catch (err) {
    next(err);
  }
});

router.get('/stats', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await getStats(req.auth));
  } catch (err) {
    next(err);
  }
});

router.get('/reports/summary', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await getReportSummary(req.auth));
  } catch (err) {
    next(err);
  }
});

router.get('/activity', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await listActivity(req.auth));
  } catch (err) {
    next(err);
  }
});

export default router;
