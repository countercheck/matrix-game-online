import { Router } from 'express';
import { authenticateToken, requireGameMember } from '../middleware/auth.middleware.js';
import * as chatController from '../controllers/chat.controller.js';

const router = Router({ mergeParams: true });

// All chat routes require authentication and game membership
router.use(authenticateToken);
router.use(requireGameMember());

router.get('/channels', chatController.getChannels);
router.post('/channels', chatController.createChannel);
router.get('/channels/:channelId/messages', chatController.getMessages);
router.post('/channels/:channelId/messages', chatController.sendMessage);
router.post('/channels/:channelId/read', chatController.markRead);

export default router;
