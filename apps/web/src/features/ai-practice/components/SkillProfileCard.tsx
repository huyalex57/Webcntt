import { TOPIC_LABELS, type SkillProfile } from '@devstudy/shared';

export interface SkillProfileCardProps {
  skills: SkillProfile[];
}

export function SkillProfileCard({ skills }: SkillProfileCardProps) {
  const weakTopics = skills.filter((s) => s.weak);

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="font-semibold">Hồ sơ năng lực (SkillProfile)</h4>
      {skills.map((s) => (
        <div key={s.topic} className="mt-2">
          <div className="flex justify-between text-xs">
            <span>{TOPIC_LABELS[s.topic]}</span>
            <span>
              {s.accuracy}% · {s.answered} câu {s.weak && '· cần ôn'}
            </span>
          </div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full ${s.accuracy < 70 ? 'bg-amber-500' : 'bg-tertiary'}`}
              style={{ width: `${s.accuracy}%` }}
            />
          </div>
        </div>
      ))}
      {weakTopics.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Điểm yếu cần ôn: {weakTopics.map((s) => TOPIC_LABELS[s.topic]).join(', ')}
        </p>
      )}
    </div>
  );
}
