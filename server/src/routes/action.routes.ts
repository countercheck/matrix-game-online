import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import * as actionController from '../controllers/action.controller.js';

const router = Router();

router.get('/:actionId', authenticateToken, actionController.getAction);
router.post('/:actionId/arguments', authenticateToken, actionController.addArgument);
router.get('/:actionId/arguments', authenticateToken, actionController.getArguments);
router.post(
  '/:actionId/complete-argumentation',
  authenticateToken,
  actionController.completeArgumentation
);
router.post('/:actionId/votes', authenticateToken, actionController.submitVote);
router.get('/:actionId/votes', authenticateToken, actionController.getVotes);
router.post('/:actionId/draw', authenticateToken, actionController.drawTokens);
router.get('/:actionId/draw', authenticateToken, actionController.getDrawResult);
router.post('/:actionId/narration', authenticateToken, actionController.submitNarration);
router.get('/:actionId/narration', authenticateToken, actionController.getNarration);

// Host edit controls
router.put('/:actionId', authenticateToken, actionController.updateAction);
router.put('/:actionId/arguments/:argumentId', authenticateToken, actionController.updateArgument);
router.put('/:actionId/narration', authenticateToken, actionController.updateNarration);

// Host skip controls
router.post('/:actionId/skip-argumentation', authenticateToken, actionController.skipArgumentation);
router.post('/:actionId/skip-voting', authenticateToken, actionController.skipVoting);

export default router;
