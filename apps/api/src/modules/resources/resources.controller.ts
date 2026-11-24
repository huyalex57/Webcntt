import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import * as resourcesService from './resources.service.js';
import { sendError, sendSuccess } from '../../utils/response.js';

function handleErr(res: Response, err: any, fallbackMessage: string) {
  if (err && typeof err.status === 'number') {
    return sendError(res, err.message, err.status, err.code, err.details);
  }
  console.error(fallbackMessage, err);
  return sendError(res, fallbackMessage, 500, 'INTERNAL_ERROR');
}

export async function listResourcesHandler(req: Request, res: Response) {
  try {
    const result = await resourcesService.listResources({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      topic: typeof req.query.topic === 'string' ? req.query.topic : undefined,
      level: typeof req.query.level === 'string' ? req.query.level : undefined,
      format: typeof req.query.format === 'string' ? req.query.format : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      sourceType: typeof req.query.sourceType === 'string' ? req.query.sourceType : undefined,
      source: typeof req.query.source === 'string' ? req.query.source : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      mine: req.query.mine === 'true',
      saved: req.query.saved === 'true',
      trending: req.query.trending === 'true',
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      viewer: req.user
        ? { userId: req.user.userId, role: req.user.role as Role }
        : undefined,
    });
    return sendSuccess(res, result.items, 200, result.meta);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải danh sách tài liệu');
  }
}

export async function listBookmarksHandler(req: Request, res: Response) {
  try {
    const items = await resourcesService.listBookmarks(req.user!.userId);
    return sendSuccess(res, items);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải danh sách tài liệu đã lưu');
  }
}

export async function getResourceHandler(req: Request, res: Response) {
  try {
    const resource = await resourcesService.getResourceById(
      String(req.params.id),
      req.user ? { userId: req.user.userId, role: req.user.role as Role } : undefined
    );
    return sendSuccess(res, resource);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải chi tiết tài liệu');
  }
}

export async function downloadResourceHandler(req: Request, res: Response) {
  try {
    const download = await resourcesService.getResourceDownloadUrl(String(req.params.id), {
      userId: req.user!.userId,
      role: req.user!.role as Role,
    });
    return sendSuccess(res, download);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tạo liên kết tải tài liệu');
  }
}

export async function presignUploadHandler(req: Request, res: Response) {
  try {
    const result = await resourcesService.requestPresignedUpload(req.user!.userId, req.body);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tạo presigned URL tải lên');
  }
}

export async function createResourceHandler(req: Request, res: Response) {
  try {
    const resource = await resourcesService.createResource(
      req.user!.userId,
      req.user!.role as Role,
      req.body
    );
    return sendSuccess(res, resource, 201);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tạo tài liệu mới');
  }
}

export async function toggleBookmarkHandler(req: Request, res: Response) {
  try {
    const result = await resourcesService.toggleBookmark(req.user!.userId, String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleErr(res, err, 'Lỗi cập nhật bộ sưu tập');
  }
}

export async function listReviewsHandler(req: Request, res: Response) {
  try {
    const reviews = await resourcesService.listResourceReviews(String(req.params.id));
    return sendSuccess(res, reviews);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải bình luận tài liệu');
  }
}

export async function createReviewHandler(req: Request, res: Response) {
  try {
    const review = await resourcesService.createResourceReview(
      req.user!.userId,
      String(req.params.id),
      req.body
    );
    return sendSuccess(res, review, 201);
  } catch (err) {
    return handleErr(res, err, 'Lỗi gửi đánh giá tài liệu');
  }
}

export async function createReportHandler(req: Request, res: Response) {
  try {
    const report = await resourcesService.createResourceReport(
      req.user!.userId,
      String(req.params.id),
      req.body
    );
    return sendSuccess(res, report, 201);
  } catch (err) {
    return handleErr(res, err, 'Lỗi gửi báo cáo vi phạm');
  }
}

// Admin / Moderator Handlers

export async function listAdminResourcesHandler(req: Request, res: Response) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING';
    const items = await resourcesService.listAdminResources(status);
    return sendSuccess(res, items);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải danh sách kiểm duyệt');
  }
}

export async function approveResourceHandler(req: Request, res: Response) {
  try {
    const updated = await resourcesService.approveResource(
      String(req.params.id),
      req.user!.userId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return sendSuccess(res, updated);
  } catch (err) {
    return handleErr(res, err, 'Lỗi phê duyệt tài liệu');
  }
}

export async function rejectResourceHandler(req: Request, res: Response) {
  try {
    const updated = await resourcesService.rejectResource(
      String(req.params.id),
      req.user!.userId,
      req.body.reason,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return sendSuccess(res, updated);
  } catch (err) {
    return handleErr(res, err, 'Lỗi từ chối tài liệu');
  }
}

export async function listAdminReportsHandler(_req: Request, res: Response) {
  try {
    const reports = await resourcesService.listAdminReports();
    return sendSuccess(res, reports);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải danh sách báo cáo vi phạm');
  }
}

export async function resolveReportHandler(req: Request, res: Response) {
  try {
    const report = await resourcesService.resolveReport(
      String(req.params.reportId),
      req.user!.userId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return sendSuccess(res, report);
  } catch (err) {
    return handleErr(res, err, 'Lỗi xử lý báo cáo vi phạm');
  }
}

export async function getAdminStatsHandler(_req: Request, res: Response) {
  try {
    const stats = await resourcesService.getAdminStats();
    return sendSuccess(res, stats);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải thống kê kiểm duyệt');
  }
}
