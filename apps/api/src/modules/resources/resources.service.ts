import {
  Prisma,
  ReportReason,
  ReportStatus,
  ResourceLevel,
  ResourceSource,
  ResourceStatus,
  ResourceTopic,
  ResourceType,
  Role,
} from '@prisma/client';
import type {
  CreateReportBody,
  CreateResourceBody,
  CreateResourceReviewBody,
  Resource,
  ResourceComment,
} from '@devstudy/shared';
import { prisma } from '../../config/prisma.js';
import { redis } from '../../config/redis.js';
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
} from '../../config/s3.js';

const TRENDING_CACHE_KEY = 'resources:trending:v1';
const TRENDING_CACHE_TTL_SEC = 60;

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Liên kết ngoài';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    // Strip common tracking query params
    for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid']) {
      parsed.searchParams.delete(param);
    }
    let normalized = parsed.toString();
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return trimmed;
  }
}

function slugifyTag(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tag'
  );
}

type ResourceWithRelations = Prisma.ResourceGetPayload<{
  include: {
    author: { select: { id: true; displayName: true; role: true } };
    tags: { include: { tag: true } };
  };
}>;

function mapResource(r: ResourceWithRelations, bookmarkedSet?: Set<string>): Resource {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    topic: r.topic as Resource['topic'],
    type: r.type as Resource['type'],
    level: r.level as Resource['level'],
    format: r.format,
    language: r.language,
    author: r.authorName || r.author.displayName,
    source: r.sourceType as Resource['source'],
    status: r.status as Resource['status'],
    rejectionReason: r.rejectionReason,
    downloads: r.downloads,
    rating: Number(r.rating.toFixed(1)),
    ratingCount: r.ratingCount,
    fileSize: r.fileSizeLabel || formatBytes(r.fileSize),
    fileSizeBytes: r.fileSize,
    fileKey: r.fileKey,
    fileUrl: r.url,
    tags: r.tags.map((rt) => rt.tag.name),
    uploaderId: r.authorId,
    isBookmarked: bookmarkedSet ? bookmarkedSet.has(r.id) : undefined,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  };
}

async function invalidateTrendingCache() {
  try {
    await redis.del(TRENDING_CACHE_KEY);
  } catch {
    // ignore redis error
  }
}

export interface ListResourcesQuery {
  q?: string;
  topic?: string;
  level?: string;
  format?: string;
  type?: string;
  sourceType?: string;
  source?: string;
  status?: string;
  mine?: boolean;
  saved?: boolean;
  trending?: boolean;
  cursor?: string;
  page?: number;
  limit?: number;
  viewer?: { userId: string; role: Role };
}

export async function listResources(query: ListResourcesQuery) {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
  const q = query.q?.trim();
  const sourceFilter = query.sourceType || query.source;

  const isModOrAdmin =
    query.viewer && (query.viewer.role === Role.MODERATOR || query.viewer.role === Role.ADMIN);

  // Trending cache fast-path (public, no search, no filters, no cursor)
  const isTrendingRequest =
    query.trending && !q && !query.topic && !query.level && !query.format && !query.type && !sourceFilter && !query.mine && !query.saved && !query.cursor;

  if (isTrendingRequest) {
    try {
      const cached = await redis.get(TRENDING_CACHE_KEY);
      if (cached) {
        const items = JSON.parse(cached) as Resource[];
        return {
          items: items.slice(0, limit),
          meta: {
            limit,
            total: items.length,
            hasNext: items.length > limit,
            cursor: items.length > 0 ? items[Math.min(items.length, limit) - 1].id : undefined,
          },
        };
      }
    } catch {
      // fallback to DB
    }
  }

  // Build base where clause
  const where: Prisma.ResourceWhereInput = {};

  if (query.mine) {
    if (!query.viewer) {
      return { items: [], meta: { limit, total: 0, hasNext: false } };
    }
    where.authorId = query.viewer.userId;
  } else if (query.saved) {
    if (!query.viewer) {
      return { items: [], meta: { limit, total: 0, hasNext: false } };
    }
    where.collections = { some: { userId: query.viewer.userId } };
    where.status = ResourceStatus.PUBLISHED;
  } else if (query.status && isModOrAdmin) {
    if (query.status !== 'ALL') {
      where.status = query.status as ResourceStatus;
    }
  } else {
    where.status = ResourceStatus.PUBLISHED;
  }

  if (query.topic) {
    where.topic = query.topic as ResourceTopic;
  }
  if (query.level) {
    where.level = query.level as ResourceLevel;
  }
  if (query.type) {
    where.type = query.type as ResourceType;
  }
  if (query.format) {
    where.format = { equals: query.format, mode: 'insensitive' };
  }
  if (sourceFilter) {
    where.sourceType = sourceFilter as ResourceSource;
  }

  // PostgreSQL Full-Text Search (tsvector / plainto_tsquery) + Tag match
  let ftsMatchedIds: string[] | null = null;
  if (q) {
    const likePattern = `%${q}%`;
    const ftsRows = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT r.id,
        ts_rank(
          to_tsvector('simple', coalesce(r.title, '') || ' ' || coalesce(r.description, '') || ' ' || coalesce(r.language, '')),
          plainto_tsquery('simple', ${q})
        ) AS rank
      FROM resources r
      WHERE
        to_tsvector('simple', coalesce(r.title, '') || ' ' || coalesce(r.description, '') || ' ' || coalesce(r.language, ''))
          @@ plainto_tsquery('simple', ${q})
        OR r.title ILIKE ${likePattern}
        OR r.description ILIKE ${likePattern}
        OR EXISTS (
          SELECT 1 FROM resource_tags rt
          JOIN tags t ON t.id = rt."tagId"
          WHERE rt."resourceId" = r.id AND t.name ILIKE ${likePattern}
        )
      ORDER BY rank DESC, r.downloads DESC, r."createdAt" DESC
      LIMIT 200
    `;

    ftsMatchedIds = ftsRows.map((row) => row.id);
    if (ftsMatchedIds.length === 0) {
      return {
        items: [],
        meta: { limit, total: 0, hasNext: false, page: query.page ?? 1 },
      };
    }
    where.id = { in: ftsMatchedIds };
  }

  const total = await prisma.resource.count({ where });

  const orderBy: Prisma.ResourceOrderByWithRelationInput[] = query.trending
    ? [{ downloads: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }]
    : [{ createdAt: 'desc' }, { id: 'desc' }];

  const findArgs: Prisma.ResourceFindManyArgs = {
    where,
    include: {
      author: { select: { id: true, displayName: true, role: true } },
      tags: { include: { tag: true } },
    },
    orderBy,
    take: limit + 1,
  };

  if (query.cursor) {
    findArgs.cursor = { id: query.cursor };
    findArgs.skip = 1;
  } else if (query.page && query.page > 1) {
    findArgs.skip = (query.page - 1) * limit;
  }

  const rows = (await prisma.resource.findMany(findArgs)) as ResourceWithRelations[];

  // Preserve FTS relevance ranking when q is active and no cursor override
  let orderedRows = rows;
  if (ftsMatchedIds && !query.cursor) {
    const rankOrder = new Map(ftsMatchedIds.map((id, idx) => [id, idx]));
    orderedRows = [...rows].sort(
      (a, b) => (rankOrder.get(a.id) ?? 9999) - (rankOrder.get(b.id) ?? 9999)
    );
  }

  const hasNext = orderedRows.length > limit;
  const sliced = hasNext ? orderedRows.slice(0, limit) : orderedRows;
  const nextCursor = hasNext && sliced.length > 0 ? sliced[sliced.length - 1].id : undefined;

  let bookmarkedSet: Set<string> | undefined;
  if (query.viewer && sliced.length > 0) {
    const bookmarks = await prisma.collection.findMany({
      where: {
        userId: query.viewer.userId,
        resourceId: { in: sliced.map((r) => r.id) },
      },
      select: { resourceId: true },
    });
    bookmarkedSet = new Set(bookmarks.map((b) => b.resourceId));
  }

  const mapped = sliced.map((r) => mapResource(r, bookmarkedSet));

  if (isTrendingRequest) {
    try {
      await redis.set(TRENDING_CACHE_KEY, JSON.stringify(mapped), 'EX', TRENDING_CACHE_TTL_SEC);
    } catch {
      // ignore redis error
    }
  }

  return {
    items: mapped,
    meta: {
      page: query.page ?? 1,
      limit,
      total,
      cursor: nextCursor,
      hasNext,
    },
  };
}

export async function getResourceById(id: string, viewer?: { userId: string; role: Role }) {
  const r = await prisma.resource.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, displayName: true, role: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!r) {
    throw { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài liệu' };
  }

  const isModOrAdmin = viewer && (viewer.role === Role.MODERATOR || viewer.role === Role.ADMIN);
  const isAuthor = viewer && viewer.userId === r.authorId;

  if (r.status !== ResourceStatus.PUBLISHED && !isModOrAdmin && !isAuthor) {
    throw {
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Tài liệu không tồn tại hoặc đang chờ kiểm duyệt',
    };
  }

  let bookmarkedSet: Set<string> | undefined;
  if (viewer) {
    const existing = await prisma.collection.findUnique({
      where: { userId_resourceId: { userId: viewer.userId, resourceId: r.id } },
    });
    bookmarkedSet = existing ? new Set([r.id]) : new Set();
  }

  return mapResource(r, bookmarkedSet);
}

export async function getResourceDownloadUrl(id: string, viewer: { userId: string; role: Role }) {
  const r = await prisma.resource.findUnique({ where: { id } });

  if (!r) {
    throw { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài liệu' };
  }

  const isModOrAdmin = viewer.role === Role.MODERATOR || viewer.role === Role.ADMIN;
  if (r.status !== ResourceStatus.PUBLISHED && !isModOrAdmin && r.authorId !== viewer.userId) {
    throw {
      status: 403,
      code: 'RESOURCE_NOT_PUBLISHED',
      message: 'Tài liệu chưa được duyệt nên không thể tải xuống',
    };
  }

  await prisma.resource.update({
    where: { id },
    data: { downloads: { increment: 1 } },
  });
  await invalidateTrendingCache();

  if (r.fileKey) {
    const ext = r.format ? `.${r.format.toLowerCase()}` : '';
    const { downloadUrl, expiresIn } = await createPresignedDownloadUrl(
      r.fileKey,
      `${r.title.slice(0, 60)}${ext}`
    );
    return {
      downloadUrl,
      expiresIn,
      isExternal: false,
      fileName: r.fileKey.split('/').pop() || r.title,
    };
  }

  if (r.url) {
    return {
      downloadUrl: r.url,
      expiresIn: null,
      isExternal: true,
      fileName: r.title,
    };
  }

  throw {
    status: 404,
    code: 'FILE_NOT_FOUND',
    message: 'Tài liệu này chưa có tệp đính kèm hoặc liên kết tải xuống',
  };
}

export async function requestPresignedUpload(
  userId: string,
  input: { fileName: string; contentType: string; fileSize: number }
) {
  return createPresignedUploadUrl({
    ...input,
    userId,
  });
}

export async function createResource(
  authorId: string,
  authorRole: Role,
  body: CreateResourceBody
) {
  const rawUrl = body.url || body.fileUrl;
  const normalizedUrl = rawUrl ? normalizeUrl(rawUrl) : null;
  const fileHash = body.fileHash ? body.fileHash.toLowerCase() : null;

  // Deduplication check by SHA-256 fileHash
  if (fileHash) {
    const dupByHash = await prisma.resource.findUnique({ where: { fileHash } });
    if (dupByHash) {
      throw {
        status: 409,
        code: 'DUPLICATE_RESOURCE',
        message: `Tài liệu này đã tồn tại trong hệ thống ("${dupByHash.title}")`,
        details: { existingResourceId: dupByHash.id, matchedBy: 'fileHash' },
      };
    }
  }

  // Deduplication check by normalized URL
  if (normalizedUrl && !body.fileKey) {
    const dupByUrl = await prisma.resource.findFirst({
      where: {
        url: normalizedUrl,
        status: { not: ResourceStatus.REJECTED },
      },
    });
    if (dupByUrl) {
      throw {
        status: 409,
        code: 'DUPLICATE_RESOURCE',
        message: `Liên kết tài liệu này đã tồn tại trong hệ thống ("${dupByUrl.title}")`,
        details: { existingResourceId: dupByUrl.id, matchedBy: 'url' },
      };
    }
  }

  const tagNames = Array.isArray(body.tags)
    ? body.tags.map((t) => t.trim()).filter(Boolean)
    : typeof body.tags === 'string'
    ? body.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const sourceType =
    authorRole === Role.ADMIN
      ? ResourceSource.OFFICIAL
      : authorRole === Role.LECTURER
      ? ResourceSource.LECTURER
      : ResourceSource.COMMUNITY;

  const inferredFormat =
    body.format ||
    (body.fileKey?.toLowerCase().endsWith('.zip')
      ? 'ZIP'
      : body.fileKey?.toLowerCase().endsWith('.docx')
      ? 'DOCX'
      : body.fileKey?.toLowerCase().endsWith('.pdf')
      ? 'PDF'
      : 'LINK');

  const created = await prisma.$transaction(async (tx) => {
    const resource = await tx.resource.create({
      data: {
        title: body.title,
        description: body.description,
        topic: body.topic as ResourceTopic,
        type: body.type as ResourceType,
        level: (body.level ?? 'INTERMEDIATE') as ResourceLevel,
        format: inferredFormat,
        language: body.language || 'Tiếng Việt',
        sourceType,
        url: normalizedUrl,
        fileKey: body.fileKey ?? null,
        fileSize: body.fileSize ?? 0,
        fileSizeLabel: body.fileSize ? formatBytes(body.fileSize) : null,
        fileHash,
        status: ResourceStatus.PENDING,
        authorId,
      },
    });

    const uniqueTags = Array.from(new Set(tagNames));
    for (const name of uniqueTags) {
      const slug = slugifyTag(name);
      const tag = await tx.tag.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      });
      await tx.resourceTag.upsert({
        where: { resourceId_tagId: { resourceId: resource.id, tagId: tag.id } },
        update: {},
        create: { resourceId: resource.id, tagId: tag.id },
      });
    }

    return tx.resource.findUniqueOrThrow({
      where: { id: resource.id },
      include: {
        author: { select: { id: true, displayName: true, role: true } },
        tags: { include: { tag: true } },
      },
    });
  });

  return mapResource(created);
}

export async function toggleBookmark(userId: string, resourceId: string) {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) {
    throw { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài liệu' };
  }

  const existing = await prisma.collection.findUnique({
    where: { userId_resourceId: { userId, resourceId } },
  });

  if (existing) {
    await prisma.collection.delete({ where: { id: existing.id } });
    return { resourceId, bookmarked: false };
  }

  await prisma.collection.create({
    data: { userId, resourceId },
  });
  return { resourceId, bookmarked: true };
}

export async function listBookmarks(userId: string) {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      resource: {
        include: {
          author: { select: { id: true, displayName: true, role: true } },
          tags: { include: { tag: true } },
        },
      },
    },
  });

  const bookmarkedSet = new Set(collections.map((c) => c.resourceId));
  return collections.map((c) => mapResource(c.resource, bookmarkedSet));
}

export async function listResourceReviews(resourceId: string): Promise<ResourceComment[]> {
  const reviews = await prisma.resourceReview.findMany({
    where: { resourceId, parentId: null },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, displayName: true, role: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, displayName: true, role: true } },
        },
      },
    },
  });

  return reviews.map((rev) => ({
    id: rev.id,
    resourceId: rev.resourceId,
    author: rev.user.displayName,
    userRole: rev.user.role,
    content: rev.content,
    rating: rev.rating ?? undefined,
    createdAt: rev.createdAt.toISOString().slice(0, 10),
    replies: rev.replies.map((rep) => ({
      id: rep.id,
      resourceId: rep.resourceId,
      author: rep.user.displayName,
      userRole: rep.user.role,
      content: rep.content,
      createdAt: rep.createdAt.toISOString().slice(0, 10),
    })),
  }));
}

export async function createResourceReview(
  userId: string,
  resourceId: string,
  body: CreateResourceReviewBody
): Promise<ResourceComment> {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) {
    throw { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài liệu' };
  }

  if (body.parentId) {
    const parent = await prisma.resourceReview.findUnique({ where: { id: body.parentId } });
    if (!parent || parent.resourceId !== resourceId) {
      throw { status: 404, code: 'PARENT_REVIEW_NOT_FOUND', message: 'Không tìm thấy bình luận gốc' };
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const review = await tx.resourceReview.create({
      data: {
        resourceId,
        userId,
        content: body.content,
        rating: body.parentId ? null : body.rating ?? null,
        parentId: body.parentId ?? null,
      },
      include: {
        user: { select: { id: true, displayName: true, role: true } },
      },
    });

    if (!body.parentId && body.rating) {
      const agg = await tx.resourceReview.aggregate({
        where: { resourceId, parentId: null, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.resource.update({
        where: { id: resourceId },
        data: {
          rating: Number((agg._avg.rating ?? body.rating).toFixed(2)),
          ratingCount: agg._count.rating,
        },
      });
    }

    return review;
  });

  await invalidateTrendingCache();

  return {
    id: created.id,
    resourceId: created.resourceId,
    author: created.user.displayName,
    userRole: created.user.role,
    content: created.content,
    rating: created.rating ?? undefined,
    createdAt: created.createdAt.toISOString().slice(0, 10),
    replies: [],
  };
}

export async function createResourceReport(
  reporterId: string,
  resourceId: string,
  body: CreateReportBody
) {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) {
    throw { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài liệu' };
  }

  const report = await prisma.report.create({
    data: {
      resourceId,
      reporterId,
      reason: body.reason as ReportReason,
      detail: body.detail,
      status: ReportStatus.OPEN,
    },
  });

  return {
    id: report.id,
    resourceId: report.resourceId,
    reason: report.reason,
    detail: report.detail,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
  };
}

// ==========================================
// Moderator / Admin Services
// ==========================================

export async function listAdminResources(status?: string) {
  const where: Prisma.ResourceWhereInput = {};
  if (status && status !== 'ALL') {
    where.status = status as ResourceStatus;
  } else if (!status) {
    where.status = ResourceStatus.PENDING;
  }

  const rows = await prisma.resource.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, displayName: true, role: true } },
      tags: { include: { tag: true } },
    },
  });

  return rows.map((r) => mapResource(r));
}

export async function approveResource(
  resourceId: string,
  moderatorId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const existing = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!existing) {
    throw { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài liệu' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.resource.update({
      where: { id: resourceId },
      data: {
        status: ResourceStatus.PUBLISHED,
        rejectionReason: null,
        reviewedById: moderatorId,
        reviewedAt: new Date(),
      },
      include: {
        author: { select: { id: true, displayName: true, role: true } },
        tags: { include: { tag: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: moderatorId,
        action: 'RESOURCE_APPROVE',
        resource: 'Resource',
        resourceId,
        metadata: {
          previousStatus: existing.status,
          newStatus: ResourceStatus.PUBLISHED,
          title: existing.title,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return res;
  });

  await invalidateTrendingCache();
  return mapResource(updated);
}

export async function rejectResource(
  resourceId: string,
  moderatorId: string,
  reason: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const existing = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!existing) {
    throw { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài liệu' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.resource.update({
      where: { id: resourceId },
      data: {
        status: ResourceStatus.REJECTED,
        rejectionReason: reason,
        reviewedById: moderatorId,
        reviewedAt: new Date(),
      },
      include: {
        author: { select: { id: true, displayName: true, role: true } },
        tags: { include: { tag: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: moderatorId,
        action: 'RESOURCE_REJECT',
        resource: 'Resource',
        resourceId,
        metadata: {
          previousStatus: existing.status,
          newStatus: ResourceStatus.REJECTED,
          title: existing.title,
          reason,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return res;
  });

  await invalidateTrendingCache();
  return mapResource(updated);
}

export async function listAdminReports() {
  const reports = await prisma.report.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      resource: { select: { id: true, title: true } },
      reporter: { select: { email: true, displayName: true } },
    },
  });

  return reports.map((r) => ({
    id: r.id,
    resourceId: r.resourceId,
    resourceTitle: r.resource.title,
    reason: r.reason,
    detail: r.detail,
    reporterEmail: r.reporter.email,
    reporterName: r.reporter.displayName,
    status: r.status,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  }));
}

export async function resolveReport(
  reportId: string,
  moderatorId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const existing = await prisma.report.findUnique({ where: { id: reportId } });
  if (!existing) {
    throw { status: 404, code: 'REPORT_NOT_FOUND', message: 'Không tìm thấy báo cáo' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rep = await tx.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.RESOLVED,
        resolvedById: moderatorId,
        resolvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: moderatorId,
        action: 'REPORT_RESOLVE',
        resource: 'Report',
        resourceId: reportId,
        metadata: {
          targetResourceId: existing.resourceId,
          reason: existing.reason,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return rep;
  });

  return updated;
}

export async function getAdminStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [pendingResources, openReports, totalUsers, todayCodeRuns] = await Promise.all([
    prisma.resource.count({ where: { status: ResourceStatus.PENDING } }),
    prisma.report.count({ where: { status: ReportStatus.OPEN } }),
    prisma.user.count(),
    prisma.runLog.count({ where: { createdAt: { gte: startOfToday } } }),
  ]);

  return {
    pendingResources,
    openReports,
    totalUsers,
    todayCodeRuns,
  };
}
