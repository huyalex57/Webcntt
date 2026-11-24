import { Link } from 'react-router-dom';
import {
  LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  TOPIC_LABELS,
  type Level,
  type QuestionType,
  type Topic,
} from '@devstudy/shared';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { QuotaBar } from '../../../components/ui/QuotaBar';
import { Select } from '../../../components/ui/Select';

export interface PracticeConfigFormProps {
  topic: Topic;
  level: Level;
  count: number;
  qtype: QuestionType;
  used: number;
  quotaLimit: number;
  isPending: boolean;
  /** Hide legacy local quota bar when real @devstudy/ai-review quota card is shown */
  hideLegacyQuota?: boolean;
  onTopicChange: (t: Topic) => void;
  onLevelChange: (l: Level) => void;
  onCountChange: (c: number) => void;
  onQtypeChange: (qt: QuestionType) => void;
  onGenerate: () => void;
}

export function PracticeConfigForm({
  topic,
  level,
  count,
  qtype,
  used,
  quotaLimit,
  isPending,
  hideLegacyQuota = false,
  onTopicChange,
  onLevelChange,
  onCountChange,
  onQtypeChange,
  onGenerate,
}: PracticeConfigFormProps) {
  const remaining = quotaLimit === Infinity ? Infinity : Math.max(0, quotaLimit - used);

  return (
    <div className="mt-3 space-y-3">
      <Field label="Chủ đề">
        <Select value={topic} onChange={(e) => onTopicChange(e.target.value as Topic)}>
          {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
            <option key={t} value={t}>
              {TOPIC_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Trình độ">
        <Select value={level} onChange={(e) => onLevelChange(e.target.value as Level)}>
          {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Số câu hỏi">
        <Select value={count} onChange={(e) => onCountChange(Number(e.target.value))}>
          {[5, 10, 20].map((n) => (
            <option key={n} value={n}>
              {n} câu
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Dạng câu hỏi">
        <Select value={qtype} onChange={(e) => onQtypeChange(e.target.value as QuestionType)}>
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      {!hideLegacyQuota && (
        <div className="rounded border border-border bg-surface p-3">
          <QuotaBar used={used} limit={quotaLimit} label="Quota luyện tập hôm nay" />
          <p className="mt-1 text-xs text-slate-500">
            Free: giới hạn cơ bản theo ngày. Premium: mở rộng hạn mức và phân tích sâu.
          </p>
        </div>
      )}
      <Button className="w-full" variant="outline" disabled={isPending} onClick={onGenerate}>
        {isPending ? 'Đang tải câu hỏi…' : 'Luyện theo chủ đề từ ngân hàng câu hỏi'}
      </Button>
      {!hideLegacyQuota && remaining < count && (
        <p className="text-sm text-red-600">
          Hết quota Free —{' '}
          <Link to="/pricing" className="font-semibold underline">
            nâng cấp Premium
          </Link>{' '}
          để tiếp tục.
        </p>
      )}
    </div>
  );
}
