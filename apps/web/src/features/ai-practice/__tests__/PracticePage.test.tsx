import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@devstudy/shared';
import PracticePage from '../../../pages/PracticePage';
import { ToastProvider } from '../../../lib/toast';

let mockAuthUser: User | null = null;

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    demoKey: 'student-free',
    getToken: () => 'test-jwt',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    switchDemo: vi.fn(),
    upgradeToPremium: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/practice']}>
        <ToastProvider>
          <PracticePage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Phase 8 — PracticePage (Core Practice API + Plug-and-Play AI Review)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it('LECTURER không gọi /ai-review/* và không thấy panel AI Review', async () => {
    mockAuthUser = {
      id: 'u-lect-1',
      email: 'bao.tq@hust.edu.vn',
      displayName: 'ThS. Tạ Quang Bảo',
      role: 'LECTURER',
      plan: 'PREMIUM',
      emailVerified: true,
    };

    const calledUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes('/practice/skill-profiles')) {
        return jsonResponse({ data: [], error: null });
      }
      if (url.includes('/practice/attempts')) {
        return jsonResponse({ data: [], error: null });
      }
      return jsonResponse({ data: null, error: { message: 'Not found', status: 404 } }, 404);
    }) as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('skill-profile-card')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-review-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-review-quota-card')).not.toBeInTheDocument();
    expect(calledUrls.some((u) => u.includes('/ai-review/'))).toBe(false);
  });

  it('STUDENT khi AI_REVIEW_ENABLED=false (status trả 404): ẩn mượt panel AI Review, core vẫn hoạt động', async () => {
    mockAuthUser = {
      id: 'u-stu-1',
      email: 'huy.nd@edu.vn',
      displayName: 'Nguyễn Đức Huy',
      role: 'STUDENT',
      plan: 'FREE',
      emailVerified: true,
    };

    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('/ai-review/status')) {
        return jsonResponse({ data: null, error: { message: 'Not Found', status: 404 } }, 404);
      }
      if (url.includes('/practice/skill-profiles')) {
        return jsonResponse({
          data: [{ topic: 'CTDL', accuracy: 75, answered: 10, weak: false }],
          error: null,
        });
      }
      if (url.includes('/practice/attempts')) {
        return jsonResponse({ data: [], error: null });
      }
      return jsonResponse({ data: null, error: null }, 404);
    }) as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/75% · 10 câu/)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-review-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-review-quota-card')).not.toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu luyện tập từ ngân hàng câu hỏi/)).toBeInTheDocument();
  });

  it('STUDENT khi AI_REVIEW_ENABLED=true: hiển thị quota mới, điểm yếu, lộ trình 0PL, tạo bộ 20 câu (có Idempotency-Key) & nộp bài chấm điểm từ server', async () => {
    mockAuthUser = {
      id: 'u-stu-pro',
      email: 'linh.tt@edu.vn',
      displayName: 'Trần Thị Linh',
      role: 'STUDENT',
      plan: 'FREE',
      emailVerified: true,
    };

    let capturedIdempotencyKey = '';
    let capturedExamSetBody: any = null;
    let capturedAttemptBody: any = null;

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/ai-review/status')) {
        return jsonResponse({ data: { enabled: true, provider: 'fake', timezone: 'Asia/Ho_Chi_Minh' }, error: null });
      }
      if (url.includes('/ai-review/quota')) {
        return jsonResponse({
          data: {
            plan: 'FREE',
            timezone: 'Asia/Ho_Chi_Minh',
            subscriptionStartedAt: '2026-11-01T00:00:00.000Z',
            quotas: {
              exam_sets: {
                metric: 'exam_sets',
                period: 'daily',
                periodKey: '2026-11-24',
                used: 1,
                limit: 3,
                remaining: 2,
                resetAt: '2026-11-25T00:00:00+07:00',
              },
              llm_tokens: {
                metric: 'llm_tokens',
                period: 'monthly',
                periodKey: '2026-11-01',
                used: 1200,
                limit: 150000,
                remaining: 148800,
                resetAt: '2026-12-01T00:00:00+07:00',
              },
            },
          },
          error: null,
        });
      }
      if (url.includes('/ai-review/recommendations')) {
        return jsonResponse({
          data: {
            generated_at: '2026-11-24T01:00:00.000Z',
            source: 'rule_based',
            cold_start: false,
            total_answers_analyzed: 12,
            weak_topics: ['HDH'],
            spaced_review_due_count: 3,
            recommended_next_topics: ['HDH', 'CSDL'],
            recommended_difficulty: 'adaptive',
            recommended_roadmaps: [
              {
                id: 'rm:articles-books:sql-roadmap',
                roadmap_slug: 'articles-books',
                title: 'SQL Roadmap',
                summary: 'Comprehensive SQL study roadmap',
                year: 2025,
                resource_format: 'article',
                related_tags: ['CSDL'],
                source_url: 'https://roadmap.sh/sql',
                attribution: 'Curated roadmap index from liuchong/awesome-roadmaps (Zero Public License 1.0)',
              },
            ],
            masteries: [
              {
                topic: 'HDH',
                mastery: 0.45,
                weakness: 0.55,
                confidence: 3,
                confidenceLabel: 'medium',
                answered: 6,
                correct: 2,
                rawAccuracy: 0.33,
                isWeak: true,
                recommendedDifficulty: 'EASY',
              },
            ],
          },
          error: null,
        });
      }
      if (url.includes('/ai-review/exam-sets') && method === 'GET' && !url.includes('/es-20-real')) {
        return jsonResponse({ data: [], error: null });
      }
      if (url.includes('/ai-review/exam-sets') && method === 'POST') {
        capturedIdempotencyKey = new Headers(init?.headers).get('Idempotency-Key') ?? '';
        capturedExamSetBody = JSON.parse(String(init?.body ?? '{}'));
        return jsonResponse(
          {
            data: {
              exam_set_id: 'es-20-real',
              source: 'llm',
              model_id: 'gemini-4-medium',
              rationale: 'Ưu tiên chủ đề HDH yếu và ôn ngắt quãng.',
              requested: 20,
              fulfilled: 2,
              rejected_ids: [],
              filled_by_fallback: 0,
              warnings: [],
              created_at: '2026-11-24T01:05:00.000Z',
            },
            error: null,
          },
          201
        );
      }
      if (url.includes('/ai-review/exam-sets/es-20-real')) {
        return jsonResponse({
          data: {
            exam_set_id: 'es-20-real',
            goal: 'Ôn tập củng cố các chủ đề yếu (bộ 20 câu)',
            source: 'llm',
            rationale: 'Ưu tiên chủ đề HDH yếu và ôn ngắt quãng.',
            requested: 20,
            fulfilled: 2,
            rejected_count: 0,
            filled_by_fallback: 0,
            status: 'CREATED',
            created_at: '2026-11-24T01:05:00.000Z',
            items: [
              {
                position: 1,
                question_id: 'q-hdh-1',
                topic: 'HDH',
                difficulty: 'medium',
                reason: 'SPACED_REVIEW',
                level: 'TRUNG_BINH',
                type: 'MCQ',
                prompt: 'Điều kiện Coffman nào KHÔNG thuộc 4 điều kiện gây Deadlock?',
                code: null,
                options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption', 'Circular Wait'],
              },
              {
                position: 2,
                question_id: 'q-csdl-1',
                topic: 'CSDL',
                difficulty: 'easy',
                reason: 'WEAK_TOPIC',
                level: 'CO_BAN',
                type: 'MCQ',
                prompt: 'B-Tree index tối ưu nhất cho loại truy vấn nào?',
                code: null,
                options: ['So sánh khoảng và bằng', 'Chỉ LIKE %abc%', 'Ảnh nhị phân', 'Âm thanh'],
              },
            ],
          },
          error: null,
        });
      }
      if (url.includes('/practice/skill-profiles')) {
        return jsonResponse({
          data: [{ topic: 'HDH', accuracy: 45, answered: 6, weak: true }],
          error: null,
        });
      }
      if (url.includes('/practice/attempts') && method === 'GET') {
        return jsonResponse({ data: [], error: null });
      }
      if (url.includes('/practice/attempts') && method === 'POST') {
        capturedAttemptBody = JSON.parse(String(init?.body ?? '{}'));
        return jsonResponse(
          {
            data: {
              attempt: {
                id: 'att-real-1',
                practiceSetId: 'es-20-real',
                topic: null,
                totalQuestions: 2,
                correctCount: 1,
                score: 50,
                durationMs: 12000,
                startedAt: '2026-11-24T01:05:00.000Z',
                submittedAt: '2026-11-24T01:05:12.000Z',
              },
              answers: [
                {
                  questionId: 'q-hdh-1',
                  topic: 'HDH',
                  difficulty: 'MEDIUM',
                  prompt: 'Điều kiện Coffman nào KHÔNG thuộc 4 điều kiện gây Deadlock?',
                  code: null,
                  options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption', 'Circular Wait'],
                  selectedIndex: 2,
                  correctIndex: 2,
                  isCorrect: true,
                  explanation: '4 điều kiện là Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait.',
                  timeSpentMs: 5000,
                  answeredAt: '2026-11-24T01:05:12.000Z',
                },
                {
                  questionId: 'q-csdl-1',
                  topic: 'CSDL',
                  difficulty: 'EASY',
                  prompt: 'B-Tree index tối ưu nhất cho loại truy vấn nào?',
                  code: null,
                  options: ['So sánh khoảng và bằng', 'Chỉ LIKE %abc%', 'Ảnh nhị phân', 'Âm thanh'],
                  selectedIndex: null,
                  correctIndex: 0,
                  isCorrect: false,
                  explanation: 'B-Tree giữ khoá theo thứ tự nên hỗ trợ truy vấn bằng và khoảng.',
                  timeSpentMs: 0,
                  answeredAt: '2026-11-24T01:05:12.000Z',
                },
              ],
              updatedSkillProfiles: [{ topic: 'HDH', accuracy: 55, answered: 7, weak: true }],
            },
            error: null,
          },
          201
        );
      }

      return jsonResponse({ data: null, error: null }, 404);
    }) as typeof fetch;

    renderPage();

    // Verify real quota card, weakness panel, and 0PL roadmap suggestion appear
    await waitFor(() => {
      expect(screen.getByTestId('ai-review-quota-card')).toBeInTheDocument();
      expect(screen.getByTestId('ai-review-panel')).toBeInTheDocument();
      expect(screen.getByTestId('ai-roadmap-suggestions')).toBeInTheDocument();
    });
    expect(screen.getByText(/Zero Public License 1.0/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /SQL Roadmap/i })).toHaveAttribute(
      'href',
      'https://roadmap.sh/sql'
    );

    // Click primary CTA "Tạo đề ôn tập cá nhân hóa (20 câu)"
    fireEvent.click(screen.getByRole('button', { name: /Tạo đề ôn tập cá nhân hóa \(20 câu\)/i }));

    await waitFor(() => {
      expect(screen.getByTestId('question-player')).toBeInTheDocument();
    });

    // Verify Idempotency-Key UUID header & num_questions=20 sent to backend
    expect(capturedIdempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(capturedExamSetBody.num_questions).toBe(20);
    expect(capturedExamSetBody.use_ai).toBe(true);

    // Answer question 1 and submit to real /practice/attempts
    fireEvent.click(screen.getByRole('button', { name: /C\. Preemption/i }));
    fireEvent.click(screen.getByRole('button', { name: /Nộp bài \(1\/2\)/i }));

    await waitFor(() => {
      expect(screen.getByTestId('practice-result-view')).toBeInTheDocument();
    });
    expect(capturedAttemptBody.practiceSetId).toBe('es-20-real');
    expect(screen.getByText(/Kết quả: 1\/2 câu đúng \(50%\)/)).toBeInTheDocument();
    expect(screen.getByText(/4 điều kiện là Mutual Exclusion/)).toBeInTheDocument();
  });

  it('Xử lý HTTP 429 QUOTA_EXCEEDED hiển thị rõ thời điểm reset & link nâng cấp Premium', async () => {
    mockAuthUser = {
      id: 'u-stu-free-429',
      email: 'huy.nd@edu.vn',
      displayName: 'Nguyễn Đức Huy',
      role: 'STUDENT',
      plan: 'FREE',
      emailVerified: true,
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/ai-review/status')) {
        return jsonResponse({ data: { enabled: true }, error: null });
      }
      if (url.includes('/ai-review/quota')) {
        return jsonResponse({
          data: {
            plan: 'FREE',
            timezone: 'Asia/Ho_Chi_Minh',
            subscriptionStartedAt: '2026-11-01T00:00:00.000Z',
            quotas: {
              exam_sets: {
                metric: 'exam_sets',
                period: 'daily',
                periodKey: '2026-11-24',
                used: 3,
                limit: 3,
                remaining: 0,
                resetAt: '2026-11-25T00:00:00+07:00',
              },
              llm_tokens: {
                metric: 'llm_tokens',
                period: 'monthly',
                periodKey: '2026-11-01',
                used: 0,
                limit: 150000,
                remaining: 150000,
                resetAt: '2026-12-01T00:00:00+07:00',
              },
            },
          },
          error: null,
        });
      }
      if (url.includes('/ai-review/recommendations')) {
        return jsonResponse({
          data: {
            generated_at: '2026-11-24T01:00:00.000Z',
            source: 'rule_based',
            cold_start: true,
            total_answers_analyzed: 0,
            weak_topics: [],
            spaced_review_due_count: 0,
            recommended_next_topics: ['CTDL'],
            recommended_difficulty: 'easy',
            recommended_roadmaps: [],
            masteries: [],
          },
          error: null,
        });
      }
      if (url.includes('/ai-review/exam-sets') && method === 'POST') {
        return jsonResponse(
          {
            data: null,
            error: {
              message: 'Bạn đã dùng hết 3 bộ đề hôm nay.',
              code: 'QUOTA_EXCEEDED',
              status: 429,
              details: {
                metric: 'exam_sets',
                plan: 'FREE',
                period: 'daily',
                limit: 3,
                used: 3,
                remaining: 0,
                reset_at: '2026-11-25T00:00:00+07:00',
                retry_after_seconds: 3600,
              },
            },
          },
          429
        );
      }
      if (url.includes('/ai-review/exam-sets') && method === 'GET') {
        return jsonResponse({ data: [], error: null });
      }
      if (url.includes('/practice/skill-profiles') || url.includes('/practice/attempts')) {
        return jsonResponse({ data: [], error: null });
      }
      return jsonResponse({ data: null, error: null }, 404);
    }) as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-review-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tạo đề ôn tập cá nhân hóa \(20 câu\)/i }));

    await waitFor(() => {
      expect(screen.getByTestId('ai-quota-exceeded-alert')).toBeInTheDocument();
    });
    const alert = screen.getByTestId('ai-quota-exceeded-alert');
    expect(alert).toHaveTextContent(/Bạn đã dùng hết 3 bộ đề hôm nay/);
    expect(alert).toHaveTextContent(/Thời điểm làm mới/);
    expect(screen.getByRole('link', { name: /Nâng cấp Premium/i })).toHaveAttribute(
      'href',
      '/pricing'
    );
  });
});
