import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Create a minimal test app with mock user routes
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Mock user database
  const users: Record<string, {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    notificationPreferences: Record<string, unknown>;
    createdAt: Date;
    lastLogin: Date | null;
  }> = {
    'user-123': {
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: null,
      notificationPreferences: { email: true, inApp: true, frequency: 'immediate' },
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date('2024-01-15'),
    },
  };

  // Mock games database
  const userGames = [
    {
      id: 'game-1',
      name: 'Active Game',
      description: 'An active game',
      status: 'ACTIVE',
      currentPhase: 'PROPOSAL',
      playerCount: 3,
      playerName: 'Test User',
      isHost: true,
      currentRound: 2,
      updatedAt: new Date(),
    },
    {
      id: 'game-2',
      name: 'Lobby Game',
      description: null,
      status: 'LOBBY',
      currentPhase: 'WAITING',
      playerCount: 2,
      playerName: 'Test User',
      isHost: false,
      currentRound: null,
      updatedAt: new Date(),
    },
  ];

  // Mock auth middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No token provided' },
      });
    }

    if (token === 'invalid-token') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      });
    }

    if (token === 'expired-token') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token expired' },
      });
    }

    // Mock user from token
    (req as any).user = {
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
    };

    next();
  };

  // GET /api/users/me
  app.get('/api/users/me', authenticateToken, (req, res) => {
    const userId = (req as any).user.id;
    const user = users[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: user,
    });
  });

  // PUT /api/users/me
  app.put('/api/users/me', authenticateToken, (req, res) => {
    const userId = (req as any).user.id;
    const user = users[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const { displayName, avatarUrl } = req.body;

    // Validation
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.length < 1 || displayName.length > 50) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Display name must be 1-50 characters' },
        });
      }
      user.displayName = displayName;
    }

    if (avatarUrl !== undefined) {
      if (avatarUrl !== null) {
        try {
          new URL(avatarUrl);
          if (avatarUrl.length > 500) {
            throw new Error('URL too long');
          }
        } catch {
          return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid avatar URL' },
          });
        }
      }
      user.avatarUrl = avatarUrl;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        notificationPreferences: user.notificationPreferences,
      },
    });
  });

  // GET /api/users/me/games
  app.get('/api/users/me/games', authenticateToken, (req, res) => {
    res.json({
      success: true,
      data: userGames,
    });
  });

  // PUT /api/users/me/notifications
  app.put('/api/users/me/notifications', authenticateToken, (req, res) => {
    const userId = (req as any).user.id;
    const user = users[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const { email, inApp, frequency } = req.body;

    // Validation
    if (email !== undefined && typeof email !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'email must be a boolean' },
      });
    }

    if (inApp !== undefined && typeof inApp !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'inApp must be a boolean' },
      });
    }

    if (frequency !== undefined && !['immediate', 'daily', 'none'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'frequency must be immediate, daily, or none' },
      });
    }

    // Update preferences
    const currentPrefs = user.notificationPreferences;
    if (email !== undefined) currentPrefs.email = email;
    if (inApp !== undefined) currentPrefs.inApp = inApp;
    if (frequency !== undefined) currentPrefs.frequency = frequency;

    res.json({
      success: true,
      data: currentPrefs,
    });
  });

  return app;
}

describe('User Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/users/me', () => {
    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-123');
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.displayName).toBe('Test User');
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 with expired token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should include notification preferences in profile', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.body.data.notificationPreferences).toBeDefined();
      expect(response.body.data.notificationPreferences.email).toBe(true);
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update display name', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ displayName: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('New Name');
    });

    it('should update avatar URL', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ avatarUrl: 'https://example.com/avatar.jpg' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should allow setting avatar URL to null', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ avatarUrl: null });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.avatarUrl).toBeNull();
    });

    it('should update both display name and avatar URL', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          displayName: 'Updated Name',
          avatarUrl: 'https://example.com/new-avatar.jpg',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.displayName).toBe('Updated Name');
      expect(response.body.data.avatarUrl).toBe('https://example.com/new-avatar.jpg');
    });

    it('should reject empty display name', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ displayName: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject display name over 50 characters', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ displayName: 'A'.repeat(51) });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid avatar URL', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ avatarUrl: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send({ displayName: 'New Name' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users/me/games', () => {
    it('should return user games with valid token', async () => {
      const response = await request(app)
        .get('/api/users/me/games')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should include game details in response', async () => {
      const response = await request(app)
        .get('/api/users/me/games')
        .set('Authorization', 'Bearer valid-token');

      const game = response.body.data[0];
      expect(game).toHaveProperty('id');
      expect(game).toHaveProperty('name');
      expect(game).toHaveProperty('status');
      expect(game).toHaveProperty('currentPhase');
      expect(game).toHaveProperty('playerCount');
      expect(game).toHaveProperty('isHost');
    });

    it('should indicate if user is host', async () => {
      const response = await request(app)
        .get('/api/users/me/games')
        .set('Authorization', 'Bearer valid-token');

      const hostGame = response.body.data.find((g: any) => g.isHost === true);
      const nonHostGame = response.body.data.find((g: any) => g.isHost === false);

      expect(hostGame).toBeDefined();
      expect(nonHostGame).toBeDefined();
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/users/me/games');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/users/me/notifications', () => {
    it('should update email notification preference', async () => {
      const response = await request(app)
        .put('/api/users/me/notifications')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(false);
    });

    it('should update inApp notification preference', async () => {
      const response = await request(app)
        .put('/api/users/me/notifications')
        .set('Authorization', 'Bearer valid-token')
        .send({ inApp: false });

      expect(response.status).toBe(200);
      expect(response.body.data.inApp).toBe(false);
    });

    it('should update frequency preference', async () => {
      const response = await request(app)
        .put('/api/users/me/notifications')
        .set('Authorization', 'Bearer valid-token')
        .send({ frequency: 'daily' });

      expect(response.status).toBe(200);
      expect(response.body.data.frequency).toBe('daily');
    });

    it('should update multiple preferences at once', async () => {
      const response = await request(app)
        .put('/api/users/me/notifications')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: false,
          inApp: true,
          frequency: 'none',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(false);
      expect(response.body.data.inApp).toBe(true);
      expect(response.body.data.frequency).toBe('none');
    });

    it('should reject invalid email preference type', async () => {
      const response = await request(app)
        .put('/api/users/me/notifications')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid frequency value', async () => {
      const response = await request(app)
        .put('/api/users/me/notifications')
        .set('Authorization', 'Bearer valid-token')
        .send({ frequency: 'weekly' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put('/api/users/me/notifications')
        .send({ email: false });

      expect(response.status).toBe(401);
    });
  });
});
