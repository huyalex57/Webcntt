import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCourse, useBuyCourse, useEnrollments, useMarkLessonDone } from '../features/courses/api';
import { SyllabusAccordion } from '../features/courses/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';
import { formatVND } from '../lib/utils';

export default function CourseDetailPage() {
  const { id = '' } = useParams();
  const { data: c, isLoading } = useCourse(id);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [paid, setPaid] = useState(false);
  const enrollments = useEnrollments();
  const buy = useBuyCourse();
  const markDone = useMarkLessonDone(id);
  const enrollment = enrollments.find((e) => e.courseId === id);

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

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`${c.instructor} · ${c.instructorRole} · ★ ${c.rating} (${c.ratingCount.toLocaleString(
          'vi-VN'
        )} đánh giá) · ${c.students.toLocaleString('vi-VN')} học viên`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <p className="text-sm leading-relaxed text-slate-700">{c.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>{c.hours} giờ video</span>
              <span>{c.lessonsCount} bài học</span>
              <span>{c.labs} lab Sandbox</span>
              <span>{c.certificate ? 'Cấp chứng nhận khi hoàn thành 100%' : 'Không cấp chứng nhận'}</span>
            </div>
          </Card>

          <SyllabusAccordion sections={c.sections} />

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
            <div className="mt-4">
              <Badge color="green">Đã đăng ký — Enrollment đang hoạt động</Badge>
              <p className="mt-2 text-sm text-slate-600">
                Bạn có quyền vào học toàn bộ bài giảng, lab và quiz của khoá này.
              </p>
              <Link to="/my-courses">
                <Button className="mt-3 w-full">Vào học ngay</Button>
              </Link>
            </div>
          ) : (
            <Button className="mt-4 w-full" disabled={buy.isPending} onClick={doBuy}>
              {buy.isPending ? 'Đang tạo đơn hàng…' : 'Đăng ký ngay — Mua lẻ'}
            </Button>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Luồng mua (workflow §5.3): tạo Order PENDING → cổng thanh toán → webhook xác nhận → Order PAID → tạo Enrollment.
            Bản demo mô phỏng webhook thành công ngay.
          </p>
        </Card>
      </div>
    </div>
  );
}
