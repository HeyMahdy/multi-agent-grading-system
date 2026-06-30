import { Router } from 'express';
import { requireAccessToken } from '../common/middleware/jwt.middleware.js';
import * as user from '../controllers/user.controller.js';

export const userRouter = Router();

userRouter.get('/me', requireAccessToken, user.getMe);
userRouter.patch('/me', requireAccessToken, user.patchMe);
