import type { Section } from '@devstudy/shared';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';

export interface SyllabusAccordionProps {
  sections: Section[];
  highlightedLessonId?: string | null;
}

export function SyllabusAccordion({ sections, highlightedLessonId }: SyllabusAccordionProps) {
  return (
    <Card className="p-5" id="course-syllabus">
      <h3 className="font-semibold">Đề cương khoá học</h3>
      {sections.map((s) => (
        <div key={s.id} className="mt-3">
          <p className="font-medium">{s.title}</p>
          <ul className="mt-1 space-y-1">
            {s.lessons.map((l) => {
              const isHighlighted = highlightedLessonId === l.id;
              return (
                <li
                  key={l.id}
                  id={`lesson-${l.id}`}
                  data-lesson-id={l.id}
                  className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm transition-all ${
                    isHighlighted
                      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                      : 'border-border bg-surface'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span>{l.title}</span>
                    {l.free && <Badge color="green">Học thử miễn phí</Badge>}
                    {isHighlighted && <Badge color="amber">Cần ôn lại</Badge>}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-slate-500">
                    {l.durationMin} phút
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Card>
  );
}
