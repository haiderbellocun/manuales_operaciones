import { Router } from 'express';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { listWorkflow, transitionWorkflow } from '../db/repos/workflow.js';

const router = Router();
router.use(authRequired);

router.get('/', requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await listWorkflow(req.auth));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/transition', requirePermission('consultar'), async (req, res, next) => {
  try {
    const { action, comments } = req.body || {};
    const result = await transitionWorkflow(req.params.id, action, req.auth, comments);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
