import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authenticateToken, userController.getProfile);
router.put('/me', authenticateToken, userController.updateProfile);
router.get('/me/games', authenticateToken, userController.getUserGames);
router.put('/me/notifications', authenticateToken, userController.updateNotificationPreferences);

export default router;
