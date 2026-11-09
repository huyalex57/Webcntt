// Mock REST client mô phỏng /api/v1 (workflow §7).
// Mọi hàm có độ trễ 300–600ms như gọi mạng thật. Khi nối backend thật,
// chỉ cần thay body của các hàm này bằng fetch() tới API Express.
import type { Course, Exam, PracticeSet, Question, Resource, RunResult, CodeSnippet, CodeLanguage } from '@devstudy/shared';
import { COURSES, EXAMS, QUESTIONS, RESOURCES, SNIPPETS } from './seed';

const delay = (ms = 300 + Math.random() * 300) => new Promise((r) => setTimeout(r, ms));
export class ApiError extends Error { status: number; code?: string; constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; } }

export interface ResourceFilter { q?: string; topic?: string; type?: string; source?: string; }
export async function listResources(f: ResourceFilter = {}): Promise<Resource[]> {
  await delay();
  return RESOURCES.filter((r) => {
    if (f.q && !(r.title + r.description + r.tags.join(' ')).toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.topic && r.topic !== f.topic) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.source && r.source !== f.source) return false;
    return true;
  });
}
export async function getResource(id: string): Promise<Resource> {
  await delay(200); const r = RESOURCES.find((x) => x.id === id);
  if (!r) throw new ApiError(404, 'Không tìm thấy tài liệu'); return r;
}
export async function reportResource(resourceId: string, reason: string, detail: string): Promise<{ ok: boolean }> {
  await delay(); void resourceId; void reason; void detail; return { ok: true };
}
export async function listCourses(q = ''): Promise<Course[]> {
  await delay();
  return COURSES.filter((c) => !q || (c.title + c.description + c.tags.join(' ')).toLowerCase().includes(q.toLowerCase()));
}
export async function getCourse(id: string): Promise<Course> {
  await delay(200); const c = COURSES.find((x) => x.id === id);
  if (!c) throw new ApiError(404, 'Không tìm thấy khoá học'); return c;
}
/** Mua khoá học: tạo Order PENDING → mô phỏng thanh toán → Enrollment.
 *  Lưu ý: bản thật chỉ webhook thanh toán mới được cấp quyền (workflow §5.3). */
export async function createOrder(courseId: string): Promise<{ orderId: string; status: 'PENDING' | 'PAID' }> {
  await delay(600); void courseId;
  return { orderId: `ORD-${Date.now().toString().slice(-6)}`, status: 'PAID' };
}
export async function listExams(): Promise<Exam[]> { await delay(); return EXAMS; }
export async function getExam(id: string): Promise<Exam> {
  await delay(200); const e = EXAMS.find((x) => x.id === id);
  if (!e) throw new ApiError(404, 'Không tìm thấy kỳ thi'); return e;
}
export async function createExam(input: { title: string; description: string; durationMin: number; languages: CodeLanguage[] }): Promise<Exam> {
  await delay(500);
  const exam: Exam = { id: `e${Date.now()}`, title: input.title, description: input.description, creator: 'Bạn (Giảng viên)', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + input.durationMin * 60000).toISOString(), durationMin: input.durationMin, languages: input.languages, status: 'DRAFT', participants: 0, problems: [] };
  EXAMS.push(exam); return exam;
}
/** Sinh bộ câu hỏi từ ngân hàng mẫu (thay cho LLM — workflow §5.4). */
export async function generatePracticeSet(req: { topic: string; level: string; count: number; type: string }): Promise<PracticeSet> {
  await delay(700);
  let pool = QUESTIONS.filter((q) => q.topic === req.topic && q.level === req.level);
  if (pool.length === 0) pool = QUESTIONS.filter((q) => q.topic === req.topic);
  if (pool.length === 0) pool = QUESTIONS.filter((q) => q.type === req.type);
  if (pool.length === 0) pool = QUESTIONS;
  const byType = pool.filter((q) => q.type === req.type);
  const chosen: Question[] = [];
  const src = byType.length > 0 ? [...byType, ...pool] : [...pool];
  const seen = new Set<string>();
  for (const q of src) { if (chosen.length >= req.count) break; if (!seen.has(q.id)) { seen.add(q.id); chosen.push(q); } }
  // Nếu ngân hàng thiếu, lặp lại câu hỏi khác topic để đủ số lượng yêu cầu (mock).
  let i = 0; while (chosen.length < req.count && QUESTIONS.length > 0) { const q = QUESTIONS[i++ % QUESTIONS.length]; if (!seen.has(q.id)) { seen.add(q.id); chosen.push(q); } else break; }
  return { id: `ps-${Date.now()}`, topic: req.topic as PracticeSet['topic'], level: req.level as PracticeSet['level'], questions: chosen.slice(0, req.count), createdAt: new Date().toISOString() };
}
/** Mock Judge0: "chạy" code bằng heuristic đơn giản — đủ để demo stdout/stderr/status. */
export async function runCode(code: string, language: CodeLanguage, stdin: string): Promise<RunResult> {
  await delay(500 + Math.random() * 400);
  const t0 = Date.now();
  void t0;
  if (/error|throw|undefined/i.test(code) && /syntax/i.test(code)) return { status: 'CE', stdout: '', stderr: 'error: expected \';\' before \'}\' token\n  (mock Judge0 — lỗi biên dịch)', exitCode: 1, timeMs: 120, memoryMb: 8 };
  if (code.includes('while(true)') || code.includes('while (true)') || code.includes('for(;;)')) return { status: 'TLE', stdout: '', stderr: '', exitCode: 124, timeMs: 2000, memoryMb: 64 };
  if (code.trim().length < 5) return { status: 'CE', stdout: '', stderr: 'error: empty source (mock Judge0)', exitCode: 1, timeMs: 80, memoryMb: 4 };
  // Mô phỏng chạy QuickSort mẫu
  if (code.includes('quickSort') && code.includes('64')) return { status: 'AC', stdout: '[INFO] Test array initialized\n[RESULT] Sorted array: [11, 12, 22, 25, 34, 64, 90]', stderr: '', exitCode: 0, timeMs: 180, memoryMb: 14 };
  if (stdin.trim()) return { status: 'AC', stdout: `[stdin] ${stdin.trim().split('\n')[0]}\nHello from ${language} (mock Judge0)`, stderr: '', exitCode: 0, timeMs: 150, memoryMb: 12 };
  if (/print\(|cout|System\.out|fmt\.Print/.test(code)) return { status: 'AC', stdout: 'Hello, DevStudy Hub! (mock Judge0)', stderr: '', exitCode: 0, timeMs: 140, memoryMb: 11 };
  return { status: 'AC', stdout: 'Program finished with exit code 0 (mock Judge0 — không có output)', stderr: '', exitCode: 0, timeMs: 110, memoryMb: 10 };
}
export async function listSnippets(): Promise<CodeSnippet[]> { await delay(200); return [...SNIPPETS]; }
export async function saveSnippet(s: CodeSnippet): Promise<CodeSnippet> { await delay(300); SNIPPETS.unshift(s); return s; }
