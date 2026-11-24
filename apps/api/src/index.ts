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
import { learningPathRouter } from './modules/learning-path/learning-path.routes.js';
import { practiceRouter } from './modules/practice/practice.routes.js';
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
app.use('/api/v1/practice', practiceRouter);
app.use('/api/v1', learningPathRouter);

// Optional plug-and-play module mount (@devstudy/ai-review)
// Flag mặc định tắt -> KHÔNG dynamic-import package, route /api/v1/ai-review/* trả 404.
// Sử dụng biến đường dẫn động để việc gỡ bỏ module không làm hỏng bước biên dịch core.
let optionalStopHooks: Array<() => Promise<void>> = [];

export async function initOptionalModules(): Promise<void> {
  if (process.env.AI_REVIEW_ENABLED !== 'true') {
    return;
  }

  const integrationPath = './integrations/ai-review/index.js';
  const integration = (await import(integrationPath)) as {
    mountAiReviewModule: (
      targetApp: typeof app
    ) => Promise<{ stop: () => Promise<void> } | null>;
  };
  const instance = await integration.mountAiReviewModule(app);
  if (instance) {
    optionalStopHooks.push(() => instance.stop());
  }
}

export async function stopOptionalModules(): Promise<void> {
  const hooks = optionalStopHooks;
  optionalStopHooks = [];
  for (const stop of hooks) {
    try {
      await stop();
    } catch (err) {
      logger.error({ err }, 'Error stopping optional module');
    }
  }
}

if (process.env.NODE_ENV !== 'test') {
  initOptionalModules()
    .then(() => {
      const server = app.listen(env.PORT, () => {
        logger.info(`🚀 DevStudy Backend API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      });

      const shutdown = async () => {
        await stopOptionalModules();
        server.close(() => process.exit(0));
      };
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to initialize optional modules');
      process.exit(1);
    });
}
