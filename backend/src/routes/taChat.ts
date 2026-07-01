import { Router } from 'express';
import { chatWithTA } from '../controllers/taChatController.js';
import { requireAccessToken } from '../common/middleware/jwt.middleware.js';

export const taChatRouter = Router();

taChatRouter.use(requireAccessToken);

// Send a message to the TA chatbot
taChatRouter.post('/ta/chat', chatWithTA);
