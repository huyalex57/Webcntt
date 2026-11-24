import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCourse, useBuyCourse, useEnrollments, useMarkLessonDone } from '../features/courses/api';
import { SyllabusAccordion } from '../features/courses/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';
import { formatVND } from '../lib/utils';
import {
  useCourseLearningPath,
  useGenerateLearningPath,
  GeneratePathFormModal,
  LearningPathTimeline,
} from '../features/learning-path';

export default function CourseDetailPage() {
  const { id = '' } = useParams();
  const { data: c, isLoading } = useCourse(id);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [paid, setPaid] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [highlightedLessonId, setHighlightedLessonId] = useState<string | null>(null);

  const enrollments = useEnrollments();
  const buy = useBuyCourse();
  const markDone = useMarkLessonDone(id);
  const enrollment = enrollments.find((e) => e.courseId === id);

  const { data: learningPath } = useCourseLearningPath(id, user?.id);
  const generatePathMutation = useGenerateLearningPath(id);

  if (isLoading) return <p className="text-sm text-slate-500">Đang tải…</p>;
  if (!c) {
    return (
      <EmptyState
        title="Không tìm thấy khoá học"
        action={
          <Link to="/courses">
            <Button>Về danh sách</Button>
          </Link>
        }
      />
    );
  }

  const doBuy = async () => {
    if (!user) {
      nav('/login', { state: { redirect: `/courses/${id}` } });
      toast.push('Bạn cần đăng nhập để mua khoá học', 'info');
      return;
    }
    const res = await buy.mutateAsync(id);
    setPaid(true);
    toast.push(
      `Thanh toán mô phỏng thành công — Order ${res.orderId} PAID, Enrollment đã được tạo (bản thật: chỉ webhook mới cấp quyền)`
    );
  };

  const handleGeneratePath = async (formData: any) => {
    try {
      await generatePathMutation.mutateAsync(formData);
      toast.push('AI Gemini 4 Hydrogen Medium đã tạo lộ trình thích ứng thành công!', 'success');
    } catch (err: any) {
      toast.push(err.message || 'Lỗi khi tạo lộ trình học tập', 'error');
    }
  };

  const handleReviewLesson = (lesson: { lessonId: string; title: string }) => {
    const allLessons = c.sections.flatMap((s) => s.lessons);
    const normalizedTarget = lesson.title.trim().toLowerCase();
    const matched =
      allLessons.find((l) => l.id === lesson.lessonId) ??
      allLessons.find((l) => l.title.trim().toLowerCase() === normalizedTarget) ??
      allLessons.find((l) => l.title.trim().toLowerCase().includes(normalizedTarget)) ??
      allLessons[0];

    if (matched) {
      setHighlightedLessonId(matched.id);
      requestAnimationFrame(() => {
        const el =
          document.getElementById(`lesson-${matched.id}`) ??
          document.getElementById('course-syllabus');
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    } else {
      document.getElementById('course-syllabus')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
    toast.push(`Đang mở lại bài học cần ôn tập: ${lesson.title}`, 'info');
  };

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`${c.instructor} · ${c.instructorRole} · ★ ${c.rating} (${c.ratingCount.toLocaleString(
          'vi-VN'
        )} đánh giá) · ${c.students.toLocaleString('vi-VN')} học viên`}
        actions={
          (enrollment || paid) ? (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setIsGenerateModalOpen(true)}
            >
              ✨ {learningPath ? 'Tạo lại lộ trình AI' : 'Tạo lộ trình AI cá nhân hoá'}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* AI Learning Path Banner / Timeline if exists */}
          {learningPath ? (
            <LearningPathTimeline
              path={learningPath}
              courseId={id}
              onReviewLesson={handleReviewLesson}
            />
          ) : (enrollment || paid) ? (
            <Card className="p-5 border-dashed border-indigo-300 bg-indigo-50/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Trợ lý Học tập Thông minh
                  </span>
                  <Badge color="navy">Gemini 4 Hydrogen Medium</Badge>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                  Bạn chưa tạo Lộ trình học tập thích ứng cho khoá học này
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  AI sẽ phân tích đề cương khoá học và hồ sơ năng lực của bạn để tự động chia chặng và kiểm tra xét duyệt.
                </p>
              </div>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 shrink-0 px-3 py-1.5 text-xs"
                onClick={() => setIsGenerateModalOpen(true)}
              >
                Tạo lộ trình ngay
              </Button>
            </Card>
          ) : null}

          <Card className="p-5">
            <p className="text-sm leading-relaxed text-slate-700">{c.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>{c.hours} giờ video</span>
              <span>{c.lessonsCount} bài học</span>
              <span>{c.labs} lab Sandbox</span>
              <span>{c.certificate ? 'Cấp chứng nhận khi hoàn thành 100%' : 'Không cấp chứng nhận'}</span>
            </div>
          </Card>

          <SyllabusAccordion sections={c.sections} highlightedLessonId={highlightedLessonId} />

          {enrollment && (
            <Card className="p-5">
              <h3 className="font-semibold">
                Tiến độ của bạn: {enrollment.progress}% ({enrollment.completedLessons}/{enrollment.totalLessons} bài)
              </h3>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-tertiary" style={{ width: `${enrollment.progress}%` }} />
              </div>
              {enrollment.certificateIssued ? (
                <p className="mt-3 text-sm font-semibold text-emerald-700">
                  Chúc mừng! Bạn đã hoàn thành 100% — chứng nhận đã được cấp.
                </p>
              ) : (
                <Button
                  className="mt-3"
                  disabled={markDone.isPending}
                  onClick={() => {
                    markDone.mutate();
                    toast.push('Đã đánh dấu hoàn thành 1 bài học');
                  }}
                >
                  Đánh dấu hoàn thành bài tiếp theo
                </Button>
              )}
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <p>
            <span className="text-2xl font-bold text-primary">{formatVND(c.price)}</span>{' '}
            <span className="text-slate-400 line-through">{formatVND(c.originalPrice)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">Hỗ trợ SV 60% · Học thử 3 bài đầu miễn phí</p>
          {enrollment || paid ? (
            <div className="mt-4 space-y-3">
              <Badge color="green">Đã đăng ký — Enrollment đang hoạt động</Badge>
              <p className="text-sm text-slate-600">
                Bạn có quyền vào học toàn bộ bài giảng, lab và lộ trình học tập thích ứng của khoá này.
              </p>
              <Link to="/my-courses">
                <Button className="w-full">Khoá học của tôi</Button>
              </Link>
            </div>
          ) : (
            <Button className="mt-4 w-full" disabled={buy.isPending} onClick={doBuy}>
              {buy.isPending ? 'Đang tạo đơn hàng…' : 'Đăng ký ngay — Mua lẻ'}
            </Button>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Học viên gói Premium được mở khoá tính năng Lộ trình học tập thích ứng với Gemini 4 Hydrogen Medium.
          </p>
        </Card>
      </div>

      <GeneratePathFormModal
        open={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onSubmit={handleGeneratePath}
        isPending={generatePathMutation.isPending}
        courseTitle={c.title}
      />
    </div>
  );
}
