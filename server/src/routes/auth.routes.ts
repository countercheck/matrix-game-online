import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/security.middleware.js';

const router = Router();

// Apply stricter rate limiting to auth endpoints (skip in test)
if (process.env.NODE_ENV !== 'test') {
  router.use(authRateLimiter);
}

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);

export default router;
