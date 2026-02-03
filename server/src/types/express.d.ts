// Express Request type augmentation
// This file extends the Express Request interface to include custom properties

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        displayName: string;
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
