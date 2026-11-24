import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';
import { authRouter, usersRouter } from './modules/auth/auth.routes.js';
import {
  adminResourcesRouter,
  resourcesRouter,
} from './modules/resources/resources.routes.js';
import { codeRouter } from './modules/code/code.routes.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { requireRole } from './middlewares/requireRole.js';
import { requirePlan } from './middlewares/requirePlan.js';
import { checkQuota } from './middlewares/checkQuota.js';
import { sendSuccess } from './utils/response.js';
import { PlanTier } from '@prisma/client';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));

// Health Check Endpoints
app.get('/health', async (req, res) => {
  return sendSuccess(res, { status: 'ok', uptime: process.uptime() });
});

app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisPong = await redis.ping();

    return sendSuccess(res, {
      database: 'connected',
      redis: redisPong === 'PONG' ? 'connected' : 'error',
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'error',
      message: err.message,
    });
  }
});

// Demo Verification Endpoints for Role & Plan Gating
app.get(
  '/api/v1/test/lecturer-only',
  requireAuth,
  requireRole('LECTURER', 'ADMIN'),
  (req, res) => {
    return sendSuccess(res, { message: 'Chào mừng Giảng viên', user: req.user });
  }
);

app.get(
  '/api/v1/test/premium-only',
  requireAuth,
  requirePlan(PlanTier.PREMIUM),
  (req, res) => {
    return sendSuccess(res, { message: 'Chào mừng Hội viên Premium', user: req.user });
  }
);

app.get(
  '/api/v1/test/ai-quota',
  requireAuth,
  checkQuota('ai_questions'),
  (req, res) => {
    return sendSuccess(res, { message: 'AI sinh câu hỏi thành công' });
  }
);

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/resources', resourcesRouter);
app.use('/api/v1/admin/resources', adminResourcesRouter);
app.use('/api/v1/code', codeRouter);

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    logger.info(`🚀 DevStudy Backend API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
}
