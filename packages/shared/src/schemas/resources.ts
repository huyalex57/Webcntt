import { z } from 'zod';

export const ResourceStatusSchema = z.enum(['PENDING', 'PUBLISHED', 'REJECTED']);
export type ResourceStatus = z.infer<typeof ResourceStatusSchema>;

export const ResourceTypeSchema = z.enum(['SLIDE', 'TEXTBOOK', 'EXAM', 'EXERCISE', 'CHEATSHEET', 'VIDEO', 'SOURCE']);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const TopicSchema = z.enum(['CTDL', 'OOP', 'CSDL', 'MANG', 'HDH', 'AI_DS', 'WEB_CLOUD']);
export type Topic = z.infer<typeof TopicSchema>;

export const TOPIC_LABELS: Record<Topic, string> = {
  CTDL: 'Cấu trúc dữ liệu & Giải thuật',
  OOP: 'Lập trình hướng đối tượng',
  CSDL: 'Cơ sở dữ liệu & SQL',
  MANG: 'Mạng máy tính & An toàn thông tin',
  HDH: 'Hệ điều hành',
  AI_DS: 'Trí tuệ nhân tạo & Data Science',
  WEB_CLOUD: 'Công nghệ Web & Cloud',
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  SLIDE: 'Slide bài giảng',
  TEXTBOOK: 'Giáo trình & Sách',
  EXAM: 'Đề thi & Đáp án',
  EXERCISE: 'Bài tập',
  CHEATSHEET: 'Cheat-sheet',
  VIDEO: 'Video',
  SOURCE: 'Đồ án & Source code',
};

export const ResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  topic: TopicSchema,
  type: ResourceTypeSchema,
  language: z.string(),
  author: z.string(),
  source: z.enum(['OFFICIAL', 'COMMUNITY', 'LECTURER']),
  status: ResourceStatusSchema,
  downloads: z.number(),
  rating: z.number(),
  ratingCount: z.number(),
  fileSize: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime().or(z.string()),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const ReportSchema = z.object({
  resourceId: z.string(),
  reason: z.enum(['BAN_QUYEN', 'SAI_LECH', 'DOC_HAI', 'KHONG_PHU_HOP']),
  detail: z.string().min(10, 'Mô tả tối thiểu 10 ký tự'),
});
export type ReportInput = z.infer<typeof ReportSchema>;
