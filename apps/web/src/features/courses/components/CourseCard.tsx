import { Link } from 'react-router-dom';
import type { Course } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { formatVND } from '../../../lib/utils';

export interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course: c }: CourseCardProps) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex gap-2">
        <Badge color="navy">{c.category}</Badge>
        <Badge>{c.level}</Badge>
      </div>
      <h3 className="mt-2 font-semibold leading-snug">{c.title}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {c.instructor} · {c.instructorRole}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        ★ {c.rating} ({c.ratingCount.toLocaleString('vi-VN')}) · {c.hours} giờ video · {c.lessonsCount} bài · {c.labs} lab
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {c.tags.map((t) => (
          <span key={t} className="rounded bg-surface px-2 py-0.5 text-xs text-slate-600">
            {t}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-3">
        <p>
          <span className="text-lg font-bold text-primary">{formatVND(c.price)}</span>{' '}
          <span className="text-sm text-slate-400 line-through">{formatVND(c.originalPrice)}</span>
        </p>
        <div className="mt-2 flex gap-2">
          <Link to={`/courses/${c.id}`}>
            <Button variant="outline">Xem đề cương</Button>
          </Link>
          <Link to={`/courses/${c.id}`}>
            <Button>Đăng ký học</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
