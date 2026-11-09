import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateExamSchema, LANGUAGE_LABELS, type CodeLanguage, type CreateExamInput } from '@devstudy/shared';
import { useCreateExam } from '../features/exams/hooks';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { canCreateExam, examCreateBlockReason } from '../lib/gating';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from '../components/ui';

export default function ExamCreatePage() {
  const { user } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const session = user ? { role: user.role, plan: user.plan } : null;
  const create = useCreateExam();
  const [langs, setLangs] = useState<CodeLanguage[]>(['cpp', 'python']);
  const [problems, setProblems] = useState([{ title: '', statement: '', points: 100 }]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateExamInput>({ resolver: zodResolver(CreateExamSchema), defaultValues: { durationMin: 90, languages: ['cpp', 'python'] } });
  if (!canCreateExam(session)) {
    return <div><PageHeader title="Tạo kỳ thi lập trình" /><EmptyState title="Bạn chưa đủ điều kiện tạo kỳ thi" hint={examCreateBlockReason(session) ?? ''} action={<Button onClick={() => nav('/pricing')}>Xem gói Premium</Button>} /></div>;
  }
  const onSubmit = async (v: CreateExamInput) => {
    const exam = await create.mutateAsync({ ...v, languages: langs });
    toast.push(`Đã tạo kỳ thi “${exam.title}” ở trạng thái DRAFT — thêm problem & test case rồi Publish`);
    nav(`/exams/${exam.id}`);
  };
  return (
    <div>
      <PageHeader title="Tạo kỳ thi lập trình" subtitle="Chỉ LECTURER + PREMIUM (workflow §5.6). Kỳ thi mới ở trạng thái DRAFT — thêm đề bài, test case ẩn/hiện rồi mới Publish." actions={<Badge color="green">LECTURER · PREMIUM — đủ quyền</Badge>} />
      <Card className="max-w-2xl p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Tên kỳ thi *">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input placeholder="VD: Đề thi cuối kỳ CTDL 2026" {...register('title')} />{errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}</Field>
          <Field label="Mô tả *">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Textarea rows={3} placeholder="Mô tả kỳ thi, đối tượng tham gia…" {...register('description')} />{errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}</Field>
          <Field label="Thời gian làm bài (phút, 15–480)">{/* eslint-disable-next-line react/jsx-props-no-spreading */}<Input type="number" {...register('durationMin', { valueAsNumber: true })} />{errors.durationMin && <p className="mt-1 text-xs text-red-600">{errors.durationMin.message}</p>}</Field>
          <Field label="Ngôn ngữ cho phép">
            <div className="flex flex-wrap gap-2">{(Object.keys(LANGUAGE_LABELS) as CodeLanguage[]).map((l) => (
              <button type="button" key={l} onClick={() => setLangs((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l])} className={`rounded border px-3 py-1.5 text-sm ${langs.includes(l) ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white'}`}>{LANGUAGE_LABELS[l]}</button>
            ))}</div>
          </Field>
          <div>
            <p className="mb-1 text-sm font-medium">Bài tập (Problem) — thêm đề bài Markdown, test case ẩn/hiện</p>
            {problems.map((p, i) => (
              <div key={i} className="mb-2 space-y-2 rounded border border-border bg-surface p-3">
                <Input placeholder={`Tên bài ${i + 1}`} value={p.title} onChange={(e) => setProblems((ps) => ps.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                <Textarea rows={2} placeholder="Đề bài (Markdown)…" value={p.statement} onChange={(e) => setProblems((ps) => ps.map((x, j) => j === i ? { ...x, statement: e.target.value } : x))} />
                <div className="flex items-center gap-2"><label className="text-sm">Điểm:</label><Input type="number" className="w-24" value={p.points} onChange={(e) => setProblems((ps) => ps.map((x, j) => j === i ? { ...x, points: Number(e.target.value) } : x))} /><span className="text-xs text-slate-500">Test case ẩn/hiện được thêm sau khi tạo kỳ thi (mock: kỳ thi mẫu đã có sẵn test case).</span></div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setProblems((p) => [...p, { title: '', statement: '', points: 100 }])}>+ Thêm bài tập</Button>
          </div>
          <Field label="Cấu hình"><Select><option>Xáo trộn thứ tự bài — Bật</option><option>Số lần nộp tối đa: 5</option><option>Chống gian lận: log chuyển tab (cơ bản)</option></Select></Field>
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Đang tạo…' : 'Tạo kỳ thi (DRAFT)'}</Button>
        </form>
      </Card>
    </div>
  );
}
