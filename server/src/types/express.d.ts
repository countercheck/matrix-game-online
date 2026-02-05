// Express Request type augmentation
// This file extends the Express Request interface to include custom properties

import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        displayName: string;
        role: UserRole;
        isBanned: boolean;
      };
      gamePlayer?: {
        id: string;
        gameId: string;
        userId: string;
        isHost: boolean;
        isActive: boolean;
      };
      action?: {
        id: string;
        initiator: {
          userId: string;
        };
      };
    }
  }
}

export {};
