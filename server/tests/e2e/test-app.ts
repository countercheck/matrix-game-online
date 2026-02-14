import express from 'express';
import cors from 'cors';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { sanitizeInput, securityHeaders } from '../../src/middleware/security.middleware.js';
import authRoutes from '../../src/routes/auth.routes.js';
import userRoutes from '../../src/routes/user.routes.js';
import gameRoutes from '../../src/routes/game.routes.js';
import actionRoutes from '../../src/routes/action.routes.js';
import roundRoutes from '../../src/routes/round.routes.js';

export function createTestApp() {
  const app = express();

  // Security headers
  app.use(securityHeaders);

  // CORS
  app.use(
    cors({
      origin: '*',
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10kb' }));

  // Input sanitization (no rate limiting in tests)
  app.use(sanitizeInput);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/actions', actionRoutes);
  app.use('/api/rounds', roundRoutes);

  // Error handling
  app.use(errorHandler);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  return app;
}
