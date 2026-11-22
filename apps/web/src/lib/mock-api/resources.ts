import type { ContributeResourceInput, Resource, ResourceComment } from '@devstudy/shared';
import { RESOURCES } from '../seed/resources';
import { delay, ApiError } from './common';

export interface ResourceFilter {
  q?: string;
  topic?: string;
  type?: string;
  source?: string;
  status?: string;
  uploaderId?: string;
}

// In-memory comments store
const COMMENTS: Record<string, ResourceComment[]> = {
  'res-ctdl-120': [
    {
      id: 'c1',
      resourceId: 'res-ctdl-120',
      author: 'Nguyễn Đức Huy',
      userRole: 'STUDENT',
      content: 'Tài liệu giải thích thuật toán Dijkstra và Quy hoạch động rất chi tiết, có code đối chứng C++ và Python cực dễ hiểu!',
      rating: 5,
      createdAt: '2026-09-10 14:30',
      replies: [
        {
          id: 'c1-1',
          resourceId: 'res-ctdl-120',
          author: 'TS. Trần Minh Tuấn',
          userRole: 'LECTURER',
          content: 'Cảm ơn em đã đánh giá! Thầy sẽ bổ sung thêm chuyên đề Segment Tree & Fenwick Tree trong bản cập nhật giữa học kỳ nhé.',
          createdAt: '2026-09-11 09:15',
        },
      ],
    },
    {
      id: 'c2',
      resourceId: 'res-ctdl-120',
      author: 'Trần Thị Linh',
      userRole: 'STUDENT',
      content: 'Bộ test case cây nhị phân cân bằng giúp mình debug bài lab trên Judge0 đạt 100/100 điểm, rất đáng lưu vào bộ sưu tập.',
      rating: 5,
      createdAt: '2026-09-15 20:00',
    },
  ],
  'res-sql-cheatsheet': [
    {
      id: 'c3',
      resourceId: 'res-sql-cheatsheet',
      author: 'Trần Thị Linh',
      userRole: 'STUDENT',
      content: 'Phần phân tích EXPLAIN ANALYZE và Covering Index áp dụng ngay được vào đồ án môn CSDL PostgreSQL.',
      rating: 5,
      createdAt: '2026-10-05 16:20',
      replies: [
        {
          id: 'c3-1',
          resourceId: 'res-sql-cheatsheet',
          author: 'ThS. Tạ Quang Bảo',
          userRole: 'LECTURER',
          content: 'Các em chú ý thêm phần thứ tự cột trong Composite Index (Leftmost Prefix Rule) ở trang 3 nhé.',
          createdAt: '2026-10-06 08:45',
        },
      ],
    },
  ],
  'res-web-fullstack': [
    {
      id: 'c4',
      resourceId: 'res-web-fullstack',
      author: 'Nguyễn Đức Huy',
      userRole: 'STUDENT',
      content: 'Sơ đồ luồng JWT Access Token in-memory kết hợp Refresh Token Rotation httpOnly cookie giải thích rất rõ ràng.',
      rating: 5,
      createdAt: '2026-10-14 21:10',
    },
  ],
};

export async function listResources(f: ResourceFilter = {}): Promise<Resource[]> {
  await delay();
  return RESOURCES.filter((r) => {
    if (f.q && !(r.title + r.description + r.tags.join(' ')).toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.topic && r.topic !== f.topic) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.source && r.source !== f.source) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.uploaderId && r.uploaderId !== f.uploaderId) return false;
    return true;
  });
}

export async function getResource(id: string): Promise<Resource> {
  await delay(200);
  const r = RESOURCES.find((x) => x.id === id);
  if (!r) throw new ApiError(404, 'Không tìm thấy tài liệu');
  return r;
}

export async function reportResource(resourceId: string, reason: string, detail: string): Promise<{ ok: boolean }> {
  await delay();
  void resourceId;
  void reason;
  void detail;
  return { ok: true };
}

export async function contributeResource(
  input: ContributeResourceInput & { author: string; uploaderId?: string }
): Promise<Resource> {
  await delay(500);
  const newRes: Resource = {
    id: `r-${Date.now()}`,
    title: input.title,
    description: input.description,
    topic: input.topic,
    type: input.type,
    language: input.language,
    author: input.author,
    source: 'COMMUNITY',
    status: 'PENDING',
    downloads: 0,
    rating: 5.0,
    ratingCount: 1,
    fileSize: '15.4 MB',
    fileUrl: input.fileUrl,
    tags: input.tags.split(',').map((t) => t.trim()).filter(Boolean),
    uploaderId: input.uploaderId,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  RESOURCES.unshift(newRes);
  return newRes;
}

export async function rateResource(
  resourceId: string,
  userRating: number
): Promise<{ rating: number; ratingCount: number }> {
  await delay(300);
  const r = RESOURCES.find((x) => x.id === resourceId);
  if (!r) throw new ApiError(404, 'Không tìm thấy tài liệu');

  const newCount = r.ratingCount + 1;
  const newRating = Number(((r.rating * r.ratingCount + userRating) / newCount).toFixed(1));
  r.rating = newRating;
  r.ratingCount = newCount;
  return { rating: newRating, ratingCount: newCount };
}

export async function listComments(resourceId: string): Promise<ResourceComment[]> {
  await delay(200);
  return COMMENTS[resourceId] ?? [];
}

export async function addComment(
  resourceId: string,
  comment: { author: string; userRole?: string; content: string; rating?: number; parentId?: string }
): Promise<ResourceComment> {
  await delay(300);
  const list = COMMENTS[resourceId] ?? [];
  const newComment: ResourceComment = {
    id: `cmt-${Date.now()}`,
    resourceId,
    author: comment.author,
    userRole: comment.userRole ?? 'STUDENT',
    content: comment.content,
    rating: comment.rating,
    createdAt: new Date().toLocaleString('vi-VN'),
  };

  if (comment.parentId) {
    const parent = list.find((c) => c.id === comment.parentId);
    if (parent) {
      parent.replies = [...(parent.replies ?? []), newComment];
    } else {
      list.unshift(newComment);
    }
  } else {
    list.unshift(newComment);
  }

  COMMENTS[resourceId] = list;

  // If a rating is included, update resource rating
  if (comment.rating) {
    await rateResource(resourceId, comment.rating);
  }

  return newComment;
}
