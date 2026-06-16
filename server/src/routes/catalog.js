import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  listAreas, listTypes, listRoles, getStats, listActivity,
} from '../db/repos/catalog.js';
import { listUsers } from '../db/repos/users.js';

const router = Router();

router.get('/areas', authRequired, async (_req, res, next) => {
  try {
    res.json(await listAreas());
  } catch (err) {
    next(err);
  }
});

router.get('/types', authRequired, async (_req, res, next) => {
  try {
    res.json(await listTypes());
  } catch (err) {
    next(err);
  }
});

router.get('/roles', authRequired, async (_req, res, next) => {
  try {
    res.json(await listRoles());
  } catch (err) {
    next(err);
  }
});

router.get('/users', authRequired, async (_req, res, next) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    next(err);
  }
});

router.get('/stats', authRequired, async (_req, res, next) => {
  try {
    res.json(await getStats());
  } catch (err) {
    next(err);
  }
});

router.get('/activity', authRequired, async (_req, res, next) => {
  try {
    res.json(await listActivity());
  } catch (err) {
    next(err);
  }
});

export default router;
