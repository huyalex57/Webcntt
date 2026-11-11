import type { Section } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';

export interface SyllabusAccordionProps {
  sections: Section[];
}

export function SyllabusAccordion({ sections }: SyllabusAccordionProps) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold">Đề cương khoá học</h3>
      {sections.map((s) => (
        <div key={s.id} className="mt-3">
          <p className="font-medium">{s.title}</p>
          <ul className="mt-1 space-y-1">
            {s.lessons.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2 text-sm"
              >
                <span>
                  {l.title} {l.free && <Badge color="green">Học thử miễn phí</Badge>}
                </span>
                <span className="text-slate-500">{l.durationMin} phút</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
