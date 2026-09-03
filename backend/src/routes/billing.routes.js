import { Router } from 'express';
import { BillingService } from '../services/BillingService.js';
import { authRequired } from '../middleware/auth.js';
import { logAuditEvent, AUDIT_ACTIONS } from '../helpers/audit.logger.js';

const router = Router();
router.use(authRequired);

router.post('/run', async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { termId, academicYearId } = req.body;

    const result = await BillingService.runBillingProcess(
      schoolId,
      termId || null,
      academicYearId || null,
      req.user.userId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/dry-run', async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { termId, academicYearId } = req.body;

    const result = await BillingService.dryRunBilling(
      schoolId,
      termId || null,
      academicYearId || null
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
