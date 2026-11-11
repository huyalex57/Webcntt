import type { PracticeSet, Question } from '@devstudy/shared';
import { QUESTIONS } from '../seed/questions';
import { delay } from './common';

/** Sinh bộ câu hỏi từ ngân hàng mẫu (thay cho LLM — workflow §5.4). */
export async function generatePracticeSet(req: {
  topic: string;
  level: string;
  count: number;
  type: string;
}): Promise<PracticeSet> {
  await delay(700);

  let pool = QUESTIONS.filter((q) => q.topic === req.topic && q.level === req.level);
  if (pool.length === 0) pool = QUESTIONS.filter((q) => q.topic === req.topic);
  if (pool.length === 0) pool = QUESTIONS.filter((q) => q.type === req.type);
  if (pool.length === 0) pool = QUESTIONS;

  const byType = pool.filter((q) => q.type === req.type);
  const chosen: Question[] = [];
  const src = byType.length > 0 ? [...byType, ...pool] : [...pool];
  const seen = new Set<string>();

  for (const q of src) {
    if (chosen.length >= req.count) break;
    if (!seen.has(q.id)) {
      seen.add(q.id);
      chosen.push(q);
    }
  }

  // Nếu ngân hàng thiếu, lặp lại câu hỏi khác topic để đủ số lượng yêu cầu (mock).
  // Đã sửa lỗi: dùng continue thay vì break khi gặp câu trùng lặp để duyệt hết pool
  let i = 0;
  let attempts = 0;
  while (chosen.length < req.count && chosen.length < QUESTIONS.length && attempts < QUESTIONS.length * 2) {
    attempts++;
    const q = QUESTIONS[i++ % QUESTIONS.length];
    if (!seen.has(q.id)) {
      seen.add(q.id);
      chosen.push(q);
    }
  }

  return {
    id: `ps-${Date.now()}`,
    topic: req.topic as PracticeSet['topic'],
    level: req.level as PracticeSet['level'],
    questions: chosen.slice(0, req.count),
    createdAt: new Date().toISOString(),
  };
}
