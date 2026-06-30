import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/signup', auth.signup);
authRouter.post('/login', auth.login);
