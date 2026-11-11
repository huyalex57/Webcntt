import { Link } from 'react-router-dom';
import { RESOURCE_TYPE_LABELS, TOPIC_LABELS, type Resource } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource: r }: ResourceCardProps) {
  return (
    <Card className="p-5">
      <div className="flex gap-2">
        <Badge color="blue">{TOPIC_LABELS[r.topic]}</Badge>
        <Badge>{RESOURCE_TYPE_LABELS[r.type]}</Badge>
        {r.status === 'PENDING' && <Badge color="amber">PENDING — chờ duyệt</Badge>}
      </div>
      <h3 className="mt-2 font-semibold leading-snug">
        <Link to={`/resources/${r.id}`} className="hover:text-primary">
          {r.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {r.tags.map((t) => (
          <span key={t} className="rounded bg-surface px-2 py-0.5 text-xs text-slate-600">
            {t}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        ★ {r.rating} ({r.ratingCount}) · ↓ {r.downloads.toLocaleString('vi-VN')} · {r.fileSize} · {r.author}
      </p>
      <div className="mt-3 flex gap-2">
        <Link to={`/resources/${r.id}`}>
          <Button variant="outline">Xem chi tiết</Button>
        </Link>
      </div>
    </Card>
  );
}
