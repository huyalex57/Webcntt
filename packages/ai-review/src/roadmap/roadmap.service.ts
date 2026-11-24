import type { TopicCode } from '../contracts/events.js';
import type { AiReviewPrismaClient } from '../db/client.js';

const ROADMAP_SLUG_RE = /^[a-z0-9-]{1,64}$/;
const ROADMAP_TOPIC_ID_RE = /^rm:[a-z0-9-]+:[a-z0-9:_-]{1,128}$/;
const CORE_TOPIC_SET = new Set<string>([
  'CTDL',
  'OOP',
  'CSDL',
  'MANG',
  'HDH',
  'AI_DS',
  'WEB_CLOUD',
]);

export const MAX_ROADMAP_OUTPUT_BYTES = 16_384; // 16 KB safety cap

export class RoadmapValidationError extends Error {
  readonly status = 400;
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'RoadmapValidationError';
    this.code = code;
  }
}

export class RoadmapNotFoundError extends Error {
  readonly status = 404;
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'RoadmapNotFoundError';
    this.code = code;
  }
}

export interface RoadmapSummaryDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  topic_count: number;
  source_url: string;
  attribution: string;
  license: string;
  commit_sha: string;
}

export interface RoadmapSubtopicDto {
  id: string;
  title: string;
  summary: string | null;
  source_url: string;
}

export interface RoadmapTopicDto {
  id: string;
  roadmap_slug: string;
  title: string;
  summary: string | null;
  year: number | null;
  resource_format: string | null;
  related_tags: string[];
  source_url: string;
  attribution: string;
  subtopics?: RoadmapSubtopicDto[];
}

export interface RoadmapDetailDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  source_url: string;
  attribution: string;
  license: string;
  commit_sha: string;
  truncated: boolean;
  topics: RoadmapTopicDto[];
}

export interface RoadmapSearchResultDto {
  query: string;
  total_returned: number;
  truncated: boolean;
  items: RoadmapTopicDto[];
}

/**
 * Strictly READ-ONLY internal service over `ai_review.roadmap_*` tables.
 * Replaces the removed MCP server process: zero filesystem access, zero runtime cloning,
 * strict input regex guards and 16 KB output cap.
 */
export class RoadmapService {
  constructor(private readonly prisma: AiReviewPrismaClient) {}

  async listRoadmaps(): Promise<RoadmapSummaryDto[]> {
    const rows = await this.prisma.roadmap.findMany({
      where: { deprecatedAt: null },
      orderBy: [{ orderIndex: 'asc' }, { slug: 'asc' }],
      include: {
        source: true,
        _count: {
          select: {
            topics: {
              where: { deprecatedAt: null, parentId: null },
            },
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      topic_count: r._count.topics,
      source_url: r.sourceUrl,
      attribution: r.source.attribution,
      license: r.source.licenseName,
      commit_sha: r.source.commitSha,
    }));
  }

  async getRoadmap(slug: string, maxDepth: number = 2): Promise<RoadmapDetailDto> {
    if (!ROADMAP_SLUG_RE.test(slug)) {
      throw new RoadmapValidationError(
        'Slug roadmap không hợp lệ (chỉ chấp nhận chữ thường, số và dấu gạch ngang)',
        'INVALID_ROADMAP_SLUG'
      );
    }

    const depth = Math.min(Math.max(Math.trunc(maxDepth), 1), 2);

    const roadmap = await this.prisma.roadmap.findFirst({
      where: { slug, deprecatedAt: null },
      include: {
        source: true,
        topics: {
          where: { deprecatedAt: null, parentId: null },
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
          include: {
            tagMaps: {
              where: { reviewedAt: { not: null } },
              orderBy: { weight: 'desc' },
            },
            ...(depth >= 2
              ? {
                  children: {
                    where: { deprecatedAt: null },
                    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
                  },
                }
              : {}),
          },
        },
      },
    });

    if (!roadmap) {
      throw new RoadmapNotFoundError(`Không tìm thấy roadmap "${slug}"`, 'ROADMAP_NOT_FOUND');
    }

    // Apply 16 KB safety cap cleanly
    const topics: RoadmapTopicDto[] = [];
    let bytes = 512;
    let truncated = false;

    for (const t of roadmap.topics as any[]) {
      const dto: RoadmapTopicDto = {
        id: t.id,
        roadmap_slug: roadmap.slug,
        title: t.title,
        summary: t.summary,
        year: t.year,
        resource_format: t.resourceFormat,
        related_tags: t.tagMaps.map((m: any) => m.tagCode),
        source_url: t.sourceUrl,
        attribution: roadmap.source.attribution,
        ...(depth >= 2 && Array.isArray(t.children)
          ? {
              subtopics: t.children.map((c: any) => ({
                id: c.id,
                title: c.title,
                summary: c.summary,
                source_url: c.sourceUrl,
              })),
            }
          : {}),
      };

      const itemBytes = Buffer.byteLength(JSON.stringify(dto), 'utf8');
      if (bytes + itemBytes > MAX_ROADMAP_OUTPUT_BYTES && topics.length > 0) {
        truncated = true;
        break;
      }
      bytes += itemBytes;
      topics.push(dto);
    }

    return {
      id: roadmap.id,
      slug: roadmap.slug,
      title: roadmap.title,
      description: roadmap.description,
      source_url: roadmap.sourceUrl,
      attribution: roadmap.source.attribution,
      license: roadmap.source.licenseName,
      commit_sha: roadmap.source.commitSha,
      truncated,
      topics,
    };
  }

  async searchTopics(params: {
    query: string;
    roadmapSlug?: string;
    tagCode?: string;
    limit?: number;
  }): Promise<RoadmapSearchResultDto> {
    const query = params.query.trim();
    if (query.length === 0 || query.length > 100) {
      throw new RoadmapValidationError(
        'Từ khoá tìm kiếm phải từ 1 đến 100 ký tự',
        'INVALID_SEARCH_QUERY'
      );
    }

    if (params.roadmapSlug && !ROADMAP_SLUG_RE.test(params.roadmapSlug)) {
      throw new RoadmapValidationError('Slug roadmap không hợp lệ', 'INVALID_ROADMAP_SLUG');
    }

    if (params.tagCode && !/^[A-Za-z0-9_-]{1,32}$/.test(params.tagCode)) {
      throw new RoadmapValidationError('Mã tag không hợp lệ', 'INVALID_TAG_CODE');
    }

    const take = Math.min(Math.max(Math.trunc(params.limit ?? 15), 1), 20);

    const rows = await this.prisma.roadmapTopic.findMany({
      where: {
        deprecatedAt: null,
        roadmap: {
          deprecatedAt: null,
          ...(params.roadmapSlug ? { slug: params.roadmapSlug } : {}),
        },
        ...(params.tagCode
          ? {
              tagMaps: {
                some: {
                  tagCode: params.tagCode,
                  reviewedAt: { not: null },
                },
              },
            }
          : {}),
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        roadmap: { include: { source: true } },
        tagMaps: {
          where: { reviewedAt: { not: null } },
          orderBy: { weight: 'desc' },
        },
      },
      orderBy: [{ kind: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const candidateRows = hasMore ? rows.slice(0, take) : rows;
    const items: RoadmapTopicDto[] = [];
    let bytes = 256;
    let truncated = hasMore;

    for (const row of candidateRows) {
      const dto: RoadmapTopicDto = {
        id: row.id,
        roadmap_slug: row.roadmap.slug,
        title: row.title,
        summary: row.summary,
        year: row.year,
        resource_format: row.resourceFormat,
        related_tags: row.tagMaps.map((m) => m.tagCode),
        source_url: row.sourceUrl,
        attribution: row.roadmap.source.attribution,
      };
      const itemBytes = Buffer.byteLength(JSON.stringify(dto), 'utf8');
      if (bytes + itemBytes > MAX_ROADMAP_OUTPUT_BYTES && items.length > 0) {
        truncated = true;
        break;
      }
      bytes += itemBytes;
      items.push(dto);
    }

    return {
      query,
      total_returned: items.length,
      truncated,
      items,
    };
  }

  async getTopic(id: string): Promise<RoadmapTopicDto> {
    if (!ROADMAP_TOPIC_ID_RE.test(id)) {
      throw new RoadmapValidationError('Định dạng ID chủ đề roadmap không hợp lệ', 'INVALID_TOPIC_ID');
    }

    const row = await this.prisma.roadmapTopic.findFirst({
      where: {
        id,
        deprecatedAt: null,
        roadmap: { deprecatedAt: null },
      },
      include: {
        roadmap: { include: { source: true } },
        tagMaps: {
          where: { reviewedAt: { not: null } },
          orderBy: { weight: 'desc' },
        },
        children: {
          where: { deprecatedAt: null },
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!row) {
      throw new RoadmapNotFoundError(`Không tìm thấy chủ đề roadmap "${id}"`, 'ROADMAP_TOPIC_NOT_FOUND');
    }

    return {
      id: row.id,
      roadmap_slug: row.roadmap.slug,
      title: row.title,
      summary: row.summary,
      year: row.year,
      resource_format: row.resourceFormat,
      related_tags: row.tagMaps.map((m) => m.tagCode),
      source_url: row.sourceUrl,
      attribution: row.roadmap.source.attribution,
      subtopics: row.children.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary,
        source_url: c.sourceUrl,
      })),
    };
  }

  /**
   * Resolves human-reviewed core exam TopicCodes linked to one or more roadmap topic IDs.
   * Ignores unreviewed auto suggestions so exam generation stays high precision.
   */
  async resolveReviewedCoreTopics(roadmapTopicIds: string[]): Promise<TopicCode[]> {
    const validIds = [...new Set(roadmapTopicIds)].filter((id) => ROADMAP_TOPIC_ID_RE.test(id));
    if (validIds.length === 0) return [];

    const maps = await this.prisma.topicTagMap.findMany({
      where: {
        topicId: { in: validIds },
        reviewedAt: { not: null },
      },
      orderBy: { weight: 'desc' },
    });

    const coreTopics: TopicCode[] = [];
    const seen = new Set<string>();
    for (const m of maps) {
      if (CORE_TOPIC_SET.has(m.tagCode) && !seen.has(m.tagCode)) {
        seen.add(m.tagCode);
        coreTopics.push(m.tagCode as TopicCode);
      }
    }
    return coreTopics;
  }

  /**
   * Returns reviewed roadmap topics matching a list of weak core topics (e.g. ['HDH', 'CSDL']).
   */
  async listRecommendedRoadmapsForTopics(
    coreTopics: TopicCode[],
    limit: number = 6
  ): Promise<RoadmapTopicDto[]> {
    if (coreTopics.length === 0) return [];
    const take = Math.min(Math.max(Math.trunc(limit), 1), 12);

    const rows = await this.prisma.roadmapTopic.findMany({
      where: {
        deprecatedAt: null,
        parentId: null,
        roadmap: { deprecatedAt: null },
        tagMaps: {
          some: {
            tagCode: { in: coreTopics },
            reviewedAt: { not: null },
          },
        },
      },
      include: {
        roadmap: { include: { source: true } },
        tagMaps: {
          where: { reviewedAt: { not: null } },
          orderBy: { weight: 'desc' },
        },
      },
      orderBy: [{ year: 'desc' }, { orderIndex: 'asc' }, { id: 'asc' }],
      take,
    });

    return rows.map((row) => ({
      id: row.id,
      roadmap_slug: row.roadmap.slug,
      title: row.title,
      summary: row.summary,
      year: row.year,
      resource_format: row.resourceFormat,
      related_tags: row.tagMaps.map((m) => m.tagCode),
      source_url: row.sourceUrl,
      attribution: row.roadmap.source.attribution,
    }));
  }
}
