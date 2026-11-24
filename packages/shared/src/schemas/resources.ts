import { z } from 'zod';
import {
  ALLOWED_RESOURCE_MIME_TYPES,
  MAX_RESOURCE_FILE_SIZE_BYTES,
} from '../constants';

export const ResourceStatusSchema = z.enum(['PENDING', 'PUBLISHED', 'REJECTED']);
export type ResourceStatus = z.infer<typeof ResourceStatusSchema>;

export const ResourceTypeSchema = z.enum([
  'SLIDE',
  'TEXTBOOK',
  'EXAM',
  'EXERCISE',
  'CHEATSHEET',
  'VIDEO',
  'SOURCE',
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ResourceLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export type ResourceLevel = z.infer<typeof ResourceLevelSchema>;

export const ResourceSourceSchema = z.enum(['OFFICIAL', 'COMMUNITY', 'LECTURER']);
export type ResourceSource = z.infer<typeof ResourceSourceSchema>;

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

export const RESOURCE_LEVEL_LABELS: Record<ResourceLevel, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

export const ResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  topic: TopicSchema,
  type: ResourceTypeSchema,
  level: ResourceLevelSchema.optional(),
  format: z.string().optional(),
  language: z.string(),
  author: z.string(),
  source: ResourceSourceSchema,
  status: ResourceStatusSchema,
  rejectionReason: z.string().nullable().optional(),
  downloads: z.number(),
  rating: z.number(),
  ratingCount: z.number(),
  fileSize: z.string(),
  fileSizeBytes: z.number().optional(),
  fileKey: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  tags: z.array(z.string()),
  uploaderId: z.string().optional(),
  isBookmarked: z.boolean().optional(),
  createdAt: z.string().datetime().or(z.string()),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const ReportReasonSchema = z.enum([
  'BAN_QUYEN',
  'SAI_LECH',
  'DOC_HAI',
  'KHONG_PHU_HOP',
  'SPAM',
  'KHAC',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  BAN_QUYEN: 'Vi phạm bản quyền học liệu',
  SAI_LECH: 'Nội dung học vụ sai lệch / lỗi thời',
  DOC_HAI: 'File độc hại / liên kết không an toàn',
  KHONG_PHU_HOP: 'Nội dung không phù hợp',
  SPAM: 'Spam / tài liệu rác',
  KHAC: 'Lý do khác',
};

export const ReportSchema = z.object({
  resourceId: z.string(),
  reason: ReportReasonSchema,
  detail: z.string().min(10, 'Mô tả tối thiểu 10 ký tự'),
});
export type ReportInput = z.infer<typeof ReportSchema>;

export const CreateReportBodySchema = z.object({
  reason: ReportReasonSchema,
  detail: z.string().trim().min(10, 'Mô tả tối thiểu 10 ký tự').max(2000),
});
export type CreateReportBody = z.infer<typeof CreateReportBodySchema>;

export const PresignUploadRequestSchema = z.object({
  fileName: z.string().trim().min(1, 'Tên file không được để trống').max(255),
  contentType: z.enum(ALLOWED_RESOURCE_MIME_TYPES, {
    errorMap: () => ({
      message: 'Chỉ chấp nhận định dạng PDF, DOCX hoặc ZIP',
    }),
  }),
  fileSize: z
    .number()
    .int()
    .positive('Kích thước file không hợp lệ')
    .max(MAX_RESOURCE_FILE_SIZE_BYTES, 'Dung lượng file tối đa là 50MB'),
});
export type PresignUploadRequest = z.infer<typeof PresignUploadRequestSchema>;

export const PresignUploadResponseSchema = z.object({
  uploadUrl: z.string(),
  fileKey: z.string(),
  bucket: z.string(),
  expiresIn: z.number(),
});
export type PresignUploadResponse = z.infer<typeof PresignUploadResponseSchema>;

export const ContributeResourceSchema = z.object({
  title: z.string().min(5, 'Tiêu đề tài liệu tối thiểu 5 ký tự'),
  description: z.string().min(10, 'Mô tả chi tiết tài liệu tối thiểu 10 ký tự'),
  topic: TopicSchema,
  type: ResourceTypeSchema,
  level: ResourceLevelSchema.optional(),
  language: z.string().min(1, 'Chọn ngôn ngữ / định dạng'),
  fileUrl: z.string().optional(),
  tags: z.string().min(1, 'Nhập ít nhất 1 tag (cách nhau bởi dấu phẩy)'),
});
export type ContributeResourceInput = z.infer<typeof ContributeResourceSchema>;

export const CreateResourceBodySchema = z
  .object({
    title: z.string().trim().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
    description: z.string().trim().min(10, 'Mô tả tối thiểu 10 ký tự').max(5000),
    topic: TopicSchema,
    type: ResourceTypeSchema,
    level: ResourceLevelSchema.default('INTERMEDIATE'),
    format: z.string().trim().max(50).optional(),
    language: z.string().trim().min(1).max(100).default('Tiếng Việt'),
    url: z.string().trim().optional(),
    fileUrl: z.string().trim().optional(),
    fileKey: z.string().trim().optional(),
    fileSize: z.number().int().nonnegative().max(MAX_RESOURCE_FILE_SIZE_BYTES).optional(),
    fileHash: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{64}$/, 'File hash phải là SHA-256 hợp lệ')
      .optional(),
    tags: z.union([z.array(z.string().trim().min(1)), z.string()]).optional(),
  })
  .refine((data) => Boolean(data.fileKey || data.url || data.fileUrl), {
    message: 'Cần đính kèm file tải lên hoặc cung cấp liên kết tài liệu',
    path: ['fileUrl'],
  });
export type CreateResourceBody = z.infer<typeof CreateResourceBodySchema>;

export const CreateResourceReviewBodySchema = z.object({
  content: z.string().trim().min(3, 'Nội dung tối thiểu 3 ký tự').max(2000),
  rating: z.number().int().min(1).max(5).optional(),
  parentId: z.string().optional(),
});
export type CreateResourceReviewBody = z.infer<typeof CreateResourceReviewBodySchema>;

export const RejectResourceBodySchema = z.object({
  reason: z.string().trim().min(5, 'Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự)').max(1000),
});
export type RejectResourceBody = z.infer<typeof RejectResourceBodySchema>;

export interface ResourceComment {
  id: string;
  resourceId: string;
  author: string;
  userRole?: string;
  content: string;
  rating?: number;
  createdAt: string;
  replies?: ResourceComment[];
}

export interface ResourceReportItem {
  id: string;
  resourceId: string;
  resourceTitle: string;
  reason: ReportReason;
  detail: string;
  reporterEmail: string;
  reporterName: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
}

export interface AdminModerationStats {
  pendingResources: number;
  openReports: number;
  totalUsers: number;
  todayCodeRuns: number;
}
