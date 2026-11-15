import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  UpdateProfileSchema,
} from '@devstudy/shared';

export const authRouter = Router();

authRouter.post('/register', validateBody(RegisterSchema), AuthController.register);
authRouter.post('/login', validateBody(LoginSchema), AuthController.login);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/logout', AuthController.logout);
authRouter.post('/forgot-password', validateBody(ForgotPasswordSchema), AuthController.forgotPassword);
authRouter.post('/reset-password', requireAuth, validateBody(ResetPasswordSchema), AuthController.resetPassword);

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, AuthController.getMe);
usersRouter.patch('/me', requireAuth, validateBody(UpdateProfileSchema), AuthController.updateProfile);
usersRouter.post('/me/change-password', requireAuth, validateBody(ChangePasswordSchema), AuthController.changePassword);
