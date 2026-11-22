import { Router } from 'express';
import {
  CreateReportBodySchema,
  CreateResourceBodySchema,
  CreateResourceReviewBodySchema,
  PresignUploadRequestSchema,
  RejectResourceBodySchema,
} from '@devstudy/shared';
import * as resourcesController from './resources.controller.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { optionalAuth } from '../../middlewares/optionalAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody } from '../../middlewares/validate.js';

export const resourcesRouter = Router();

// Public & Student Routes (/api/v1/resources)
resourcesRouter.get('/', optionalAuth, resourcesController.listResourcesHandler);
resourcesRouter.get('/bookmarks', requireAuth, resourcesController.listBookmarksHandler);
resourcesRouter.post(
  '/presign-upload',
  requireAuth,
  validateBody(PresignUploadRequestSchema),
  resourcesController.presignUploadHandler
);
resourcesRouter.post(
  '/',
  requireAuth,
  validateBody(CreateResourceBodySchema),
  resourcesController.createResourceHandler
);

resourcesRouter.get('/:id', optionalAuth, resourcesController.getResourceHandler);
resourcesRouter.get('/:id/download', requireAuth, resourcesController.downloadResourceHandler);
resourcesRouter.post('/:id/bookmark', requireAuth, resourcesController.toggleBookmarkHandler);
resourcesRouter.get('/:id/reviews', resourcesController.listReviewsHandler);
resourcesRouter.post(
  '/:id/reviews',
  requireAuth,
  validateBody(CreateResourceReviewBodySchema),
  resourcesController.createReviewHandler
);
resourcesRouter.post(
  '/:id/report',
  requireAuth,
  validateBody(CreateReportBodySchema),
  resourcesController.createReportHandler
);

// Moderator / Admin Routes (/api/v1/admin/resources)
export const adminResourcesRouter = Router();

adminResourcesRouter.use(requireAuth, requireRole('MODERATOR', 'ADMIN'));

adminResourcesRouter.get('/stats', resourcesController.getAdminStatsHandler);
adminResourcesRouter.get('/reports', resourcesController.listAdminReportsHandler);
adminResourcesRouter.patch(
  '/reports/:reportId/resolve',
  resourcesController.resolveReportHandler
);
adminResourcesRouter.get('/', resourcesController.listAdminResourcesHandler);
adminResourcesRouter.patch('/:id/approve', resourcesController.approveResourceHandler);
adminResourcesRouter.patch(
  '/:id/reject',
  validateBody(RejectResourceBodySchema),
  resourcesController.rejectResourceHandler
);
