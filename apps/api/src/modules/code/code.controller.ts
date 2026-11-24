import { Request, Response } from 'express';
import { PlanTier } from '@prisma/client';
import * as codeService from './code.service.js';
import { sendError, sendSuccess } from '../../utils/response.js';

function handleErr(res: Response, err: any, fallbackMessage: string) {
  if (err && typeof err.status === 'number') {
    return sendError(res, err.message, err.status, err.code, err.details);
  }
  console.error(fallbackMessage, err);
  return sendError(res, fallbackMessage, 500, 'INTERNAL_ERROR');
}

export async function listLanguagesHandler(_req: Request, res: Response) {
  try {
    const languages = await codeService.listLanguages();
    return sendSuccess(res, languages);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải danh sách ngôn ngữ lập trình');
  }
}

export async function getQuotaHandler(req: Request, res: Response) {
  try {
    const quota = await codeService.getUserCodeQuota(
      req.user!.userId,
      req.user!.plan as PlanTier
    );
    return sendSuccess(res, quota);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải thông tin hạn mức chạy code');
  }
}

export async function runCodeHandler(req: Request, res: Response) {
  try {
    const result = await codeService.runCode(
      req.user!.userId,
      req.user!.plan as PlanTier,
      req.body,
      req.quota
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleErr(res, err, 'Lỗi thực thi mã nguồn');
  }
}

export async function listSnippetsHandler(req: Request, res: Response) {
  try {
    const snippets = await codeService.listUserSnippets(req.user!.userId);
    return sendSuccess(res, snippets);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải danh sách snippet');
  }
}

export async function getSnippetHandler(req: Request, res: Response) {
  try {
    const snippet = await codeService.getSnippetById(String(req.params.id), req.user?.userId);
    return sendSuccess(res, snippet);
  } catch (err) {
    return handleErr(res, err, 'Lỗi tải snippet');
  }
}

export async function createSnippetHandler(req: Request, res: Response) {
  try {
    const snippet = await codeService.createSnippet(
      req.user!.userId,
      req.user!.plan as PlanTier,
      req.body
    );
    return sendSuccess(res, snippet, 201);
  } catch (err) {
    return handleErr(res, err, 'Lỗi lưu snippet mới');
  }
}

export async function deleteSnippetHandler(req: Request, res: Response) {
  try {
    const result = await codeService.deleteSnippet(req.user!.userId, String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleErr(res, err, 'Lỗi xoá snippet');
  }
}
