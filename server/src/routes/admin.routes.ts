import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireModerator, requireAdmin } from '../middleware/admin.middleware.js';

const router = Router();

// All admin routes require authentication
router.use(authenticateToken);

// ============================================================================
// Dashboard - Moderator+
// ============================================================================
router.get('/dashboard', requireModerator, adminController.getDashboard);

// ============================================================================
// User Management
// ============================================================================

// List and view users - Moderator+
router.get('/users', requireModerator, adminController.listUsers);
router.get('/users/:userId', requireModerator, adminController.getUserDetails);

// Update role - Admin only
router.put('/users/:userId/role', requireAdmin, adminController.updateUserRole);

// Ban/unban - Moderator+
router.post('/users/:userId/ban', requireModerator, adminController.banUser);
router.post('/users/:userId/unban', requireModerator, adminController.unbanUser);

// ============================================================================
// Game Management
// ============================================================================

// List and view games - Moderator+
router.get('/games', requireModerator, adminController.listGames);
router.get('/games/:gameId', requireModerator, adminController.getGameDetails);

// Delete game - Admin only
router.delete('/games/:gameId', requireAdmin, adminController.deleteGame);

// Pause/resume - Moderator+
router.post('/games/:gameId/pause', requireModerator, adminController.pauseGame);
router.post('/games/:gameId/resume', requireModerator, adminController.resumeGame);

// Remove player - Moderator+
router.post(
  '/games/:gameId/players/:playerId/remove',
  requireModerator,
  adminController.removePlayer
);

// ============================================================================
// Audit Logs - Admin only
// ============================================================================
router.get('/audit-logs', requireAdmin, adminController.listAuditLogs);

export default router;
