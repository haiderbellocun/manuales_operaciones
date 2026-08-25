import { Router } from 'express';
import { authRequired, requirePermission } from '../middleware/auth.js';
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../db/repos/notifications.js';

const router = Router();
router.use(authRequired);
router.use(requirePermission('consultar'));

router.get('/', async (req, res, next) => {
  try {
    const [items, unread] = await Promise.all([
      listNotifications(req.user.sub, req.query.limit),
      countUnreadNotifications(req.user.sub),
    ]);
    res.json({ items, unread });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user.sub);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    const ok = await markNotificationRead(req.user.sub, req.params.id);
    if (!ok) return res.status(404).json({ message: 'Notificacion no encontrada.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
