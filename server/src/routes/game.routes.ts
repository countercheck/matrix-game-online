import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { uploadRateLimiter } from '../middleware/security.middleware.js';
import * as gameController from '../controllers/game.controller.js';
import { upload } from '../config/multer.js';

const router = Router();

router.post('/', authenticateToken, gameController.createGame);
router.get('/:gameId', authenticateToken, gameController.getGame);
router.put('/:gameId', authenticateToken, gameController.updateGame);
router.delete('/:gameId', authenticateToken, gameController.deleteGame);
router.post('/:gameId/image', authenticateToken, uploadRateLimiter, upload.single('image'), gameController.uploadGameImage);
router.post('/:gameId/join', authenticateToken, gameController.joinGame);
router.post('/:gameId/select-persona', authenticateToken, gameController.selectPersona);
router.post('/:gameId/leave', authenticateToken, gameController.leaveGame);
router.post('/:gameId/start', authenticateToken, gameController.startGame);
router.get('/:gameId/players', authenticateToken, gameController.getPlayers);
router.get('/:gameId/history', authenticateToken, gameController.getGameHistory);
router.get('/:gameId/rounds', authenticateToken, gameController.getRounds);
router.post('/:gameId/actions', authenticateToken, gameController.proposeAction);

export default router;
