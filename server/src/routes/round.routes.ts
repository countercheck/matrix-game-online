import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import * as roundController from '../controllers/round.controller.js';

const router = Router();

router.get('/:roundId', authenticateToken, roundController.getRound);
router.post('/:roundId/summary', authenticateToken, roundController.submitRoundSummary);
router.get('/:roundId/summary', authenticateToken, roundController.getRoundSummary);
router.put('/:roundId/summary', authenticateToken, roundController.updateRoundSummary);

export default router;
