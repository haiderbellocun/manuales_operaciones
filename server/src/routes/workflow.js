import { Router } from 'express';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { listWorkflow } from '../db/repos/workflow.js';

const router = Router();
router.use(authRequired);

router.get('/', requirePermission('consultar'), async (req, res, next) => {
  try {
    res.json(await listWorkflow(req.user.sub));
  } catch (err) {
    next(err);
  }
});

export default router;
