// Gating phía FE — chỉ là UX. Backend (Express middleware requireRole /
// requirePlan / requireEnrollment / checkQuota, workflow §4) mới là nguồn
// kiểm tra cuối cùng. Mọi quyết định ở đây phải được API kiểm tra lại.
import type { PlanTier, Role } from '@devstudy/shared';
export type Session = { role: Role; plan: PlanTier } | null;

export const canDownload = (s: Session) => !!s;
export const canPractice = (s: Session) => !!s;
export const canUsePlayground = (s: Session) => !!s;
export const canJoinExam = (s: Session) => !!s;
export const canCreateResource = (s: Session) => !!s && (s.role === 'LECTURER' || s.role === 'ADMIN');
export const canCreateCourse = (s: Session) => !!s && (s.role === 'LECTURER' || s.role === 'ADMIN');
/** Chỉ LECTURER + PREMIUM mới tạo bài thi (workflow §4, business flow §5.2). */
export const canCreateExam = (s: Session) => !!s && s.role === 'LECTURER' && s.plan === 'PREMIUM';
export const examCreateBlockReason = (s: Session): string | null => {
  if (!s) return 'Bạn cần đăng nhập để tạo kỳ thi.';
  if (s.role !== 'LECTURER') return 'Chỉ giảng viên mới được tạo bài thi. Gói Premium không thay thế role giảng viên.';
  if (s.plan !== 'PREMIUM') return 'Tạo bài thi yêu cầu gói Premium (giảng viên). Nâng cấp để mở khoá.';
  return null;
};
export const canModerate = (s: Session) => !!s && (s.role === 'MODERATOR' || s.role === 'ADMIN');
export const isAdmin = (s: Session) => !!s && s.role === 'ADMIN';
export const aiQuotaLimit = (s: Session) => (s && s.plan === 'PREMIUM' ? Infinity : 10);
export const runQuotaLimit = (s: Session) => (s && s.plan === 'PREMIUM' ? 200 : 30);
export const snippetLimit = (s: Session) => (s && s.plan === 'PREMIUM' ? 50 : 3);
export const playgroundLimits = (s: Session) => (s && s.plan === 'PREMIUM'
  ? { ramMb: 1024, timeoutS: 10, label: 'Premium: 1 GB RAM / 10s' }
  : { ramMb: 256, timeoutS: 2, label: 'Free: 256 MB RAM / 2s' });
