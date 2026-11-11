import { Link } from 'react-router-dom';
import type { Exam } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { formatDateTime } from '../../../lib/utils';

export interface ExamCardProps {
  exam: Exam;
}

export function ExamCard({ exam: e }: ExamCardProps) {
  return (
    <Card className="p-5">
      <div className="flex gap-2">
        <Badge
          color={
            e.status === 'PUBLISHED'
              ? 'green'
              : e.status === 'DRAFT'
              ? 'amber'
              : 'slate'
          }
        >
          {e.status}
        </Badge>
        <Badge>{e.durationMin} phút</Badge>
        <Badge>{e.problems.length} bài</Badge>
      </div>
      <h3 className="mt-2 font-semibold leading-snug">{e.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{e.description}</p>
      <p className="mt-2 text-xs text-slate-500">
        {formatDateTime(e.startsAt)} → {formatDateTime(e.endsAt)} · {e.participants} thí sinh · Ngôn
        ngữ: {e.languages.join(', ').toUpperCase()} · Tạo bởi {e.creator}
      </p>
      <div className="mt-3">
        <Link to={`/exams/${e.id}`}>
          <Button>{e.status === 'DRAFT' ? 'Xem bản nháp' : 'Vào thi →'}</Button>
        </Link>
      </div>
    </Card>
  );
}
