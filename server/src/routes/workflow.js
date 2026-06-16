import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { listWorkflow } from '../db/repos/workflow.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    res.json(await listWorkflow(req.user.sub));
  } catch (err) {
    next(err);
  }
});

export default router;
