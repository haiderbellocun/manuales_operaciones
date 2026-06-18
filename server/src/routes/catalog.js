import { Router } from 'express';
import { authRequired, requirePermission } from '../middleware/auth.js';
import {
  listAreas, listTypes, listRoles, listPeople, getStats, listActivity,
} from '../db/repos/catalog.js';
import { listAssignableUsers, listUsers } from '../db/repos/users.js';

const router = Router();

router.get('/areas', authRequired, requirePermission('consultar'), async (_req, res, next) => {
  try {
    res.json(await listAreas());
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

router.get('/people', authRequired, requirePermission('consultar'), async (_req, res, next) => {
  try {
    res.json(await listPeople());
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

router.get('/assignees', authRequired, requirePermission('consultar'), async (_req, res, next) => {
  try {
    res.json(await listAssignableUsers());
  } catch (err) {
    next(err);
  }
});

router.get('/stats', authRequired, requirePermission('consultar'), async (_req, res, next) => {
  try {
    res.json(await getStats());
  } catch (err) {
    next(err);
  }
});

router.get('/activity', authRequired, requirePermission('consultar'), async (_req, res, next) => {
  try {
    res.json(await listActivity());
  } catch (err) {
    next(err);
  }
});

export default router;
