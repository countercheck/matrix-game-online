import { Router, text } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { uploadRateLimiter } from '../middleware/security.middleware.js';
import * as gameController from '../controllers/game.controller.js';
import { upload } from '../config/multer.js';

const router = Router();

// Static routes must be before /:gameId to avoid matching as a gameId
router.get('/resolution-methods', authenticateToken, gameController.getResolutionMethods);
router.post(
  '/import',
  authenticateToken,
  uploadRateLimiter,
  text({ type: ['text/yaml', 'text/plain', 'application/x-yaml'], limit: '5mb' }),
  gameController.importGame
);
router.post('/', authenticateToken, gameController.createGame);
router.get('/:gameId', authenticateToken, gameController.getGame);
router.put('/:gameId', authenticateToken, gameController.updateGame);
router.delete('/:gameId', authenticateToken, gameController.deleteGame);
router.post(
  '/:gameId/image',
  authenticateToken,
  uploadRateLimiter,
  upload.single('image'),
  gameController.uploadGameImage
);
router.post('/:gameId/join', authenticateToken, gameController.joinGame);
router.post('/:gameId/select-persona', authenticateToken, gameController.selectPersona);
router.put('/:gameId/personas/:personaId', authenticateToken, gameController.updatePersona);
router.post(
  '/:gameId/personas/:personaId/set-lead',
  authenticateToken,
  gameController.setPersonaLead
);
router.post('/:gameId/leave', authenticateToken, gameController.leaveGame);
router.post('/:gameId/start', authenticateToken, gameController.startGame);
router.get('/:gameId/players', authenticateToken, gameController.getPlayers);
router.get('/:gameId/history', authenticateToken, gameController.getGameHistory);
router.get('/:gameId/rounds', authenticateToken, gameController.getRounds);
router.post('/:gameId/actions', authenticateToken, gameController.proposeAction);

// Export/import
router.get('/:gameId/export', authenticateToken, gameController.exportGame);

// Timeout controls
router.get('/:gameId/timeout-status', authenticateToken, gameController.getTimeoutStatus);
router.post('/:gameId/extend-timeout', authenticateToken, gameController.extendTimeout);

// Host skip controls
router.post('/:gameId/skip-proposals', authenticateToken, gameController.skipProposals);

// Player role assignment (host only)
// PUT /games/:gameId/players/:playerId/role
// Auth: JWT required; only the game host may change player roles.
// Request body (JSON):
//   {
//     "role": string // New role identifier for the player; unsupported values are rejected.
//   }
// Possible error responses:
//   400 Bad Request  - Missing/invalid body or role value.
//   401 Unauthorized - Missing or invalid authentication token.
//   403 Forbidden    - Authenticated user is not the host for this game.
//   404 Not Found    - Game or player does not exist or is not visible to the caller.
router.put('/:gameId/players/:playerId/role', authenticateToken, gameController.setPlayerRole);

export default router;
