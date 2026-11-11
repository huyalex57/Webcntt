import type { CodeLanguage, Exam, Problem } from '@devstudy/shared';
import { EXAMS } from '../seed/exams';
import { delay, ApiError } from './common';

export async function listExams(): Promise<Exam[]> {
  await delay();
  return EXAMS;
}

export async function getExam(id: string): Promise<Exam> {
  await delay(200);
  const e = EXAMS.find((x) => x.id === id);
  if (!e) throw new ApiError(404, 'Không tìm thấy kỳ thi');
  return e;
}

export async function createExam(input: {
  title: string;
  description: string;
  durationMin: number;
  languages: CodeLanguage[];
  problems?: Problem[];
}): Promise<Exam> {
  await delay(500);
  const exam: Exam = {
    id: `e${Date.now()}`,
    title: input.title,
    description: input.description,
    creator: 'Bạn (Giảng viên)',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + input.durationMin * 60000).toISOString(),
    durationMin: input.durationMin,
    languages: input.languages,
    status: 'DRAFT',
    participants: 0,
    problems: input.problems ?? [],
  };
  EXAMS.push(exam);
  return exam;
}
