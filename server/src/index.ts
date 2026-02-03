import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import {
  sanitizeInput,
  generalRateLimiter,
  securityHeaders,
  csrfProtection,
} from './middleware/security.middleware.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import gameRoutes from './routes/game.routes.js';
import actionRoutes from './routes/action.routes.js';
import roundRoutes from './routes/round.routes.js';
import { startTimeoutWorker } from './workers/timeout.worker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(securityHeaders);

// CORS
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing with size limit
app.use(express.json({ limit: '10kb' }));

// Rate limiting (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', generalRateLimiter);
}

// Input sanitization
app.use(sanitizeInput);

// CSRF protection (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use(csrfProtection);
}

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

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);

  // Start timeout worker if enabled
  if (process.env.ENABLE_TIMEOUT_WORKER !== 'false') {
    const intervalMs = process.env.TIMEOUT_CHECK_INTERVAL_MS
      ? parseInt(process.env.TIMEOUT_CHECK_INTERVAL_MS, 10)
      : undefined;
    startTimeoutWorker({ intervalMs });
  }
});

export default app;
