import { Router } from 'express';
import { authRequired, requirePermission } from '../middleware/auth.js';
import {
  listAreas, listCoordinations, listTypes, listRoles, updateRole, listPeople, getStats, getMapDocumentCounts, getReportSummary, listActivity,
} from '../db/repos/catalog.js';
import { createUser, listAssignableUsers, listUsers, updateUser } from '../db/repos/users.js';
import { getDocumentAnalytics } from '../db/repos/analytics.js';
import { hasGlobalReadScope } from '../config/accessRoles.js';
import {
  GENERAL_COORDINATION_AREA_ID,
  OPERATION_ACADEMIC_AREA_ID,
} from '../config/areas.js';

const router = Router();

function scopedByArea(auth, items, areaOf) {
  const role = Number(auth.role);
  if (hasGlobalReadScope(auth) || [5, 6].includes(role)) return items;
  if (!auth.area) return [];
  return items.filter((item) => {
    const rawItemArea = areaOf(item);
    if (rawItemArea === null || rawItemArea === undefined) return true;
    const itemArea = Number(rawItemArea);
    if (itemArea !== Number(auth.area)) return false;
    if (
      Number(auth.area) !== OPERATION_ACADEMIC_AREA_ID
      && auth.coordination
      && item.coordination
    ) {
      return Number(item.coordination) === Number(auth.coordination);
    }
    return true;
  });
}

router.get('/areas', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    const areas = await listAreas();
    const scoped = scopedByArea(req.auth, areas, item => item.id);
    const general = areas.find(area => Number(area.id) === GENERAL_COORDINATION_AREA_ID);
    if (general && !scoped.some(area => Number(area.id) === GENERAL_COORDINATION_AREA_ID)) {
      scoped.push(general);
    }
    res.json(scoped);
  } catch (err) {
    next(err);
  }
});

router.get('/coordinations', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    const areaId = req.query.areaId || req.query.area;
    const items = await listCoordinations(areaId || null);
    if (hasGlobalReadScope(req.auth) || !req.auth.area) {
      return res.json(items);
    }
    if (Number(req.auth.area) === OPERATION_ACADEMIC_AREA_ID) {
      if (areaId && Number(areaId) !== OPERATION_ACADEMIC_AREA_ID) {
        return res.json([]);
      }
      return res.json(items.filter(
        item => Number(item.areaId) === OPERATION_ACADEMIC_AREA_ID,
      ));
    }
    if (areaId && Number(areaId) !== Number(req.auth.area)) {
      return res.json([]);
    }
    if (req.auth.coordination) {
      return res.json(items.filter(item => Number(item.id) === Number(req.auth.coordination)));
    }
    if (req.auth.area) {
      return res.json(items.filter(item => Number(item.areaId) === Number(req.auth.area)));
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
    res.json(scopedByArea(req.auth, await listPeople(), item => item.area));
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

router.get('/assignees', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    const requestedAreaId = req.query.areaId ?? req.query.area ?? null;
    const isAdmin = req.auth.perms?.administrar === true;
    const isGeneralDocument = Number(requestedAreaId) === GENERAL_COORDINATION_AREA_ID;
    if (isGeneralDocument) {
      if (!isAdmin && (req.auth.perms?.crear !== true || !req.auth.area)) {
        return res.status(403).json({
          message: 'No tienes un area de origen habilitada para asignar el flujo de un documento general.',
        });
      }
      return res.json(await listAssignableUsers(isAdmin ? null : req.auth.area));
    }
    if (
      requestedAreaId
      && !isAdmin
      && Number(requestedAreaId) !== Number(req.auth.area)
    ) {
      return res.status(403).json({
        message: 'No puedes consultar responsables de flujo de otra area.',
      });
    }
    if (!requestedAreaId && !isAdmin && !req.auth.area) return res.json([]);
    const areaId = requestedAreaId || (!isAdmin ? req.auth.area : null);
    res.json(await listAssignableUsers(areaId));
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

router.get('/map/counts', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await getMapDocumentCounts(req.auth));
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

router.get('/reports/analytics', authRequired, requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await getDocumentAnalytics(req.auth, req.query || {}));
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
