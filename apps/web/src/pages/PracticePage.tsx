import { useEffect, useRef, useState } from 'react';
import {
  LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  TOPIC_LABELS,
  type Level,
  type QuestionType,
  type SkillProfile,
  type SubmitPracticeAttemptResponse,
  type Topic,
} from '@devstudy/shared';
import {
  useAiReviewExamSets,
  useAiReviewQuota,
  useAiReviewRecommendations,
  useAiReviewStatus,
  useCreateAndLoadAiExamSet,
  useGenerateAiReviewSummary,
  useGeneratePracticeSet,
  useLoadAiExamSetDetail,
  useLoadPracticeQuestions,
  usePracticeAttempts,
  usePracticeSkillProfiles,
  useSubmitPracticeAttempt,
  type ActivePracticeSession,
  type AiReviewExamSetDetailDto,
  type AiReviewSummaryDto,
  type ApiQuotaErrorShape,
} from '../features/ai-practice/api';
import {
  AiReviewPanel,
  AiReviewQuotaCard,
  PracticeConfigForm,
  PracticeResultView,
  QuestionPlayer,
  SkillProfileCard,
} from '../features/ai-practice/components';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { aiQuotaLimit } from '../lib/gating';
import { SEED_SKILL_PROFILES } from '../lib/seed';
import { addDailyCount, getDailyCount, loadJSON, saveJSON } from '../lib/utils';
import { Card, PageHeader } from '../components/ui';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

function isQuotaError(err: unknown): err is ApiQuotaErrorShape {
  if (!err || typeof err !== 'object') return false;
  const e = err as ApiQuotaErrorShape;
  return e.status === 429 || e.code === 'QUOTA_EXCEEDED';
}

function toSessionFromExamSet(
  detail: AiReviewExamSetDetailDto,
  modelId?: string | null,
  warnings?: string[]
): ActivePracticeSession {
  return {
    id: detail.exam_set_id,
    source: detail.source,
    title: detail.goal,
    examSetId: detail.exam_set_id,
    modelId: modelId ?? null,
    rationale: detail.rationale,
    warnings: warnings ?? [],
    startedAt: new Date().toISOString(),
    questions: detail.items
      .filter((item) => Boolean(item.prompt && item.options?.length))
      .map((item) => ({
        id: item.question_id,
        topic: item.topic,
        level: item.level ?? 'TRUNG_BINH',
        type: item.type ?? 'MCQ',
        difficulty: item.difficulty.toUpperCase(),
        prompt: item.prompt!,
        code: item.code ?? null,
        options: item.options!,
        tags: item.tags,
        estimatedTimeSec: item.estimated_time_sec,
        reason: item.reason,
      })),
  };
}

export default function PracticePage() {
  const { user, isAuthReady } = useAuth();
  const toast = useToast();
  const sessionInfo = user ? { role: user.role, plan: user.plan } : null;
  const legacyQuotaLimit = aiQuotaLimit(sessionInfo);
  const isStudent = user?.role === 'STUDENT';
  const useRealApi = !USE_MOCK && isAuthReady !== false && Boolean(user);

  // Core practice bank config state
  const [used, setUsed] = useState(() => getDailyCount('ai-used'));
  const [topic, setTopic] = useState<Topic>('CTDL');
  const [level, setLevel] = useState<Level>('TRUNG_BINH');
  const [count, setCount] = useState(10);
  const [qtype, setQtype] = useState<QuestionType>('MCQ');

  // Active quiz session & grading state
  const [activeSession, setActiveSession] = useState<ActivePracticeSession | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [gradedResult, setGradedResult] = useState<SubmitPracticeAttemptResponse | null>(null);
  const [mockSkills, setMockSkills] = useState<SkillProfile[]>(() =>
    loadJSON<SkillProfile[]>('skill-profile', SEED_SKILL_PROFILES)
  );

  // AI Review UI state
  const [aiSummary, setAiSummary] = useState<AiReviewSummaryDto | null>(null);
  const [quotaError, setQuotaError] = useState<ApiQuotaErrorShape | null>(null);

  // Per-question time tracking & player scroll refs
  const questionEnteredAtRef = useRef<number>(Date.now());
  const timeSpentByQRef = useRef<Record<string, number>>({});
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const prevUserIdRef = useRef<string | undefined>(user?.id);

  // Reset local AI Review / session state whenever active account changes (e.g. demo role switch)
  useEffect(() => {
    if (prevUserIdRef.current !== user?.id) {
      prevUserIdRef.current = user?.id;
      setActiveSession(null);
      setGradedResult(null);
      setAiSummary(null);
      setQuotaError(null);
      setIdx(0);
      setAnswers({});
      timeSpentByQRef.current = {};
    }
  }, [user?.id]);

  // Real Core Practice API hooks
  const skillProfilesQuery = usePracticeSkillProfiles(useRealApi, user?.id);
  const attemptsQuery = usePracticeAttempts(useRealApi, 6, user?.id);
  const loadQuestionsMut = useLoadPracticeQuestions();
  const submitAttemptMut = useSubmitPracticeAttempt();
  const mockGenMut = useGeneratePracticeSet();

  // Plug-and-play AI Review probe & hooks (strictly STUDENT + module enabled)
  const aiStatusQuery = useAiReviewStatus(useRealApi && isStudent);
  const aiReviewEnabled = useRealApi && isStudent && aiStatusQuery.data?.enabled === true;

  const aiQuotaQuery = useAiReviewQuota(aiReviewEnabled, user?.id);
  const aiRecsQuery = useAiReviewRecommendations(aiReviewEnabled, user?.id);
  const aiExamSetsQuery = useAiReviewExamSets(aiReviewEnabled, 6, user?.id);
  const createExamSetMut = useCreateAndLoadAiExamSet();
  const loadExamSetDetailMut = useLoadAiExamSetDetail();
  const generateSummaryMut = useGenerateAiReviewSummary();

  const displayedSkills: SkillProfile[] = useRealApi
    ? skillProfilesQuery.data ?? []
    : mockSkills;

  const startSession = (next: ActivePracticeSession) => {
    setActiveSession(next);
    setIdx(0);
    setAnswers({});
    setGradedResult(null);
    timeSpentByQRef.current = {};
    questionEnteredAtRef.current = Date.now();
    requestAnimationFrame(() => {
      const el = playerContainerRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const flushCurrentQuestionTime = () => {
    if (!activeSession) return;
    const current = activeSession.questions[idx];
    if (!current) return;
    const elapsed = Math.max(0, Date.now() - questionEnteredAtRef.current);
    timeSpentByQRef.current[current.id] = (timeSpentByQRef.current[current.id] ?? 0) + elapsed;
    questionEnteredAtRef.current = Date.now();
  };

  const handleJump = (nextIdx: number) => {
    if (!activeSession) return;
    if (nextIdx < 0 || nextIdx >= activeSession.questions.length) return;
    flushCurrentQuestionTime();
    setIdx(nextIdx);
  };

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  // Load questions from Core Practice Bank (real API or mock fallback)
  const handleStartTopicPractice = async () => {
    setQuotaError(null);
    if (USE_MOCK) {
      const remaining =
        legacyQuotaLimit === Infinity ? Infinity : Math.max(0, legacyQuotaLimit - used);
      if (remaining < count) {
        toast.push(
          `Hết quota Free hôm nay (còn ${remaining} câu). Nâng cấp Premium để tiếp tục.`,
          'error'
        );
        return;
      }
      const ps = await mockGenMut.mutateAsync({ topic, level, count, type: qtype });
      setUsed(addDailyCount('ai-used', ps.questions.length));
      startSession({
        id: ps.id,
        source: 'mock',
        title: `${TOPIC_LABELS[ps.topic]} (${ps.questions.length} câu)`,
        topic: ps.topic,
        level: ps.level,
        startedAt: new Date().toISOString(),
        questions: ps.questions.map((q) => ({
          id: q.id,
          topic: q.topic,
          level: q.level,
          type: q.type,
          difficulty: q.difficulty,
          prompt: q.prompt,
          code: q.code,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      });
      return;
    }

    try {
      const questions = await loadQuestionsMut.mutateAsync({
        topic,
        level,
        type: qtype,
        limit: count,
      });

      // If strict filter by level/type has no results, widen to topic-only APPROVED pool and inform user
      let widenedNotice: string | null = null;
      let finalQuestions = questions;
      if (questions.length === 0) {
        finalQuestions = await loadQuestionsMut.mutateAsync({ topic, limit: count });
        if (finalQuestions.length > 0) {
          widenedNotice = `Không có câu hỏi khớp đúng trình độ "${LEVEL_LABELS[level]}" và dạng "${QUESTION_TYPE_LABELS[qtype]}" cho ${TOPIC_LABELS[topic]}; hệ thống đã tự mở rộng sang toàn bộ câu hỏi đã duyệt của chủ đề này (${finalQuestions.length} câu).`;
          toast.push(widenedNotice, 'info');
        }
      }

      if (finalQuestions.length === 0) {
        toast.push('Không tìm thấy câu hỏi đã duyệt cho chủ đề này.', 'error');
        return;
      }

      if (!aiReviewEnabled) {
        setUsed(addDailyCount('ai-used', finalQuestions.length));
      }

      startSession({
        id: `bank-${Date.now()}`,
        source: 'practice_bank',
        title: `Luyện tập ${TOPIC_LABELS[topic]}`,
        topic,
        level,
        warnings: widenedNotice ? [widenedNotice] : [],
        startedAt: new Date().toISOString(),
        questions: finalQuestions.map((q) => ({
          id: q.id,
          topic: q.topic,
          level: q.level,
          type: q.type,
          difficulty: q.difficulty,
          prompt: q.prompt,
          code: q.code,
          options: q.options,
          tags: q.tags,
          estimatedTimeSec: q.estimatedTimeSec,
        })),
      });
    } catch (err: any) {
      toast.push(err?.message || 'Không thể tải bộ câu hỏi luyện tập', 'error');
    }
  };

  // Create personalized 20-question exam set via @devstudy/ai-review
  const handleCreatePersonalizedSet = async (opts: {
    goal: string;
    topics?: Topic[];
    roadmapTopicIds?: string[];
    useAi: boolean;
  }) => {
    setQuotaError(null);
    try {
      const { created, detail } = await createExamSetMut.mutateAsync({
        goal: opts.goal,
        topics: opts.topics,
        roadmap_topic_ids: opts.roadmapTopicIds,
        num_questions: 20,
        difficulty: 'adaptive',
        use_ai: opts.useAi,
      });

      const nextSession = toSessionFromExamSet(detail, created.model_id, created.warnings);
      if (nextSession.questions.length === 0) {
        toast.push('Bộ đề không có câu hỏi hợp lệ khả dụng.', 'error');
        return;
      }

      startSession(nextSession);
      toast.push(
        `Đã dựng bộ đề cá nhân hóa ${nextSession.questions.length} câu (${created.source}).`
      );
    } catch (err: any) {
      if (isQuotaError(err)) {
        setQuotaError(err);
        toast.push(err.message || 'Bạn đã hết hạn mức tạo bộ đề hôm nay.', 'error');
        return;
      }
      toast.push(err?.message || 'Không thể tạo bộ đề ôn tập cá nhân hóa', 'error');
    }
  };

  // Resume an existing personalized exam set
  const handleResumeExamSet = async (examSetId: string) => {
    try {
      const detail = await loadExamSetDetailMut.mutateAsync(examSetId);
      const nextSession = toSessionFromExamSet(detail);
      if (nextSession.questions.length === 0) {
        toast.push('Không tải được câu hỏi của bộ đề này.', 'error');
        return;
      }
      startSession(nextSession);
    } catch (err: any) {
      toast.push(err?.message || 'Không thể tải bộ đề cá nhân hóa', 'error');
    }
  };

  // Generate AI weakness summary & study plan
  const handleGenerateSummary = async (opts: { goal?: string; topics?: Topic[] }) => {
    setQuotaError(null);
    try {
      const res = await generateSummaryMut.mutateAsync({
        goal: opts.goal,
        topics: opts.topics,
      });
      setAiSummary(res);
      toast.push(
        res.source === 'llm'
          ? 'Đã hoàn tất phân tích điểm yếu & lộ trình bằng AI.'
          : 'Đã tạo phân tích điểm yếu ở chế độ dự phòng rule-based.'
      );
    } catch (err: any) {
      if (isQuotaError(err)) {
        setQuotaError(err);
        toast.push(err.message || 'Bạn đã dùng hết hạn mức token AI chu kỳ này.', 'error');
        return;
      }
      toast.push(err?.message || 'Không thể tạo phân tích ôn tập AI', 'error');
    }
  };

  // Submit attempt to real server-side grading (POST /api/v1/practice/attempts)
  const handleSubmit = async () => {
    if (!activeSession) return;
    flushCurrentQuestionTime();

    if (activeSession.source === 'mock') {
      const correctCount = activeSession.questions.filter(
        (q) => answers[q.id] === q.correctIndex
      ).length;
      const score = Math.round((correctCount / activeSession.questions.length) * 100);
      const durationMs = Math.max(
        1000,
        Date.now() - new Date(activeSession.startedAt).getTime()
      );
      const nowIso = new Date().toISOString();

      const mockResponse: SubmitPracticeAttemptResponse = {
        attempt: {
          id: `mock-attempt-${Date.now()}`,
          practiceSetId: activeSession.id,
          topic: activeSession.topic ?? null,
          totalQuestions: activeSession.questions.length,
          correctCount,
          score,
          durationMs,
          startedAt: activeSession.startedAt,
          submittedAt: nowIso,
        },
        answers: activeSession.questions.map((q) => ({
          questionId: q.id,
          topic: q.topic,
          difficulty: (q.difficulty as 'EASY' | 'MEDIUM' | 'HARD') || 'MEDIUM',
          prompt: q.prompt,
          code: q.code ?? null,
          options: q.options,
          selectedIndex: answers[q.id] ?? null,
          correctIndex: q.correctIndex ?? 0,
          isCorrect: answers[q.id] === q.correctIndex,
          explanation: q.explanation ?? '',
          timeSpentMs: timeSpentByQRef.current[q.id] ?? 0,
          answeredAt: nowIso,
        })),
        updatedSkillProfiles: mockSkills,
      };

      if (activeSession.topic) {
        const nextSkills = mockSkills.map((s) =>
          s.topic === activeSession.topic
            ? {
                ...s,
                answered: s.answered + activeSession.questions.length,
                accuracy: Math.round(
                  (s.accuracy * s.answered + score) /
                    (s.answered + activeSession.questions.length) || score
                ),
                weak: score < 70,
              }
            : s
        );
        setMockSkills(nextSkills);
        saveJSON('skill-profile', nextSkills);
      }
      setGradedResult(mockResponse);
      toast.push(
        `Đã nộp bài: ${correctCount}/${activeSession.questions.length} đúng (${score}%)`
      );
      return;
    }

    try {
      const durationMs = Math.max(
        1000,
        Date.now() - new Date(activeSession.startedAt).getTime()
      );
      const response = await submitAttemptMut.mutateAsync({
        practiceSetId: activeSession.examSetId,
        topic: activeSession.topic,
        startedAt: activeSession.startedAt,
        durationMs,
        answers: activeSession.questions.map((q) => ({
          questionId: q.id,
          selectedIndex: answers[q.id] ?? null,
          timeSpentMs: Math.round(timeSpentByQRef.current[q.id] ?? 0),
        })),
      });

      setGradedResult(response);
      toast.push(
        `Đã nộp bài: ${response.attempt.correctCount}/${response.attempt.totalQuestions} đúng (${response.attempt.score}%) — SkillProfile đã cập nhật từ DB.`
      );
    } catch (err: any) {
      toast.push(err?.message || 'Không thể nộp bài luyện tập', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Luyện tập & Ôn thi cá nhân hoá"
        subtitle={
          aiReviewEnabled
            ? 'Tạo bộ đề 20 câu cá nhân hoá theo lịch sử làm bài, phân tích điểm yếu và gợi ý lộ trình ôn tập từ nguồn mở.'
            : 'Luyện tập trắc nghiệm CNTT từ ngân hàng câu hỏi chuẩn hóa và theo dõi hồ sơ năng lực.'
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          {aiReviewEnabled && (
            <AiReviewQuotaCard
              quota={aiQuotaQuery.data}
              isLoading={aiQuotaQuery.isLoading}
              quotaError={quotaError}
            />
          )}

          <Card className="p-5">
            <h3 className="font-semibold">Luyện nhanh theo chủ đề</h3>
            <PracticeConfigForm
              topic={topic}
              level={level}
              count={count}
              qtype={qtype}
              used={used}
              quotaLimit={legacyQuotaLimit}
              isPending={loadQuestionsMut.isPending || mockGenMut.isPending}
              hideLegacyQuota={aiReviewEnabled}
              onTopicChange={setTopic}
              onLevelChange={setLevel}
              onCountChange={setCount}
              onQtypeChange={setQtype}
              onGenerate={handleStartTopicPractice}
            />
            <SkillProfileCard
              skills={displayedSkills}
              isLoading={useRealApi && skillProfilesQuery.isLoading}
            />

            {useRealApi && attemptsQuery.data && attemptsQuery.data.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <h4 className="text-sm font-semibold">Lịch sử nộp bài gần đây</h4>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {attemptsQuery.data.slice(0, 5).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded bg-surface px-2.5 py-1.5"
                    >
                      <span className="font-medium text-slate-700">
                        {a.topic ? TOPIC_LABELS[a.topic as Topic] ?? a.topic : 'Tổng hợp'} (
                        {a.correctCount}/{a.totalQuestions})
                      </span>
                      <span
                        className={
                          a.score >= 70 ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'
                        }
                      >
                        {a.score}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <div ref={playerContainerRef} className="lg:col-span-2">
          {gradedResult ? (
            <PracticeResultView
              result={gradedResult}
              onReset={() => {
                setActiveSession(null);
                setGradedResult(null);
              }}
            />
          ) : activeSession ? (
            <QuestionPlayer
              session={activeSession}
              idx={idx}
              answers={answers}
              isSubmitting={submitAttemptMut.isPending}
              onSelectAnswer={handleSelectAnswer}
              onJump={handleJump}
              onSubmit={handleSubmit}
              onCancel={() => {
                setActiveSession(null);
                setGradedResult(null);
              }}
            />
          ) : aiReviewEnabled ? (
            <AiReviewPanel
              recommendations={aiRecsQuery.data}
              isLoadingRecommendations={aiRecsQuery.isLoading}
              recentExamSets={aiExamSetsQuery.data}
              summary={aiSummary}
              isCreatingExamSet={createExamSetMut.isPending}
              isGeneratingSummary={generateSummaryMut.isPending}
              isLoadingExamSetDetail={loadExamSetDetailMut.isPending}
              onCreatePersonalizedSet={handleCreatePersonalizedSet}
              onGenerateSummary={handleGenerateSummary}
              onResumeExamSet={handleResumeExamSet}
            />
          ) : (
            <Card className="p-6">
              <h3 className="font-semibold">Bắt đầu luyện tập từ ngân hàng câu hỏi</h3>
              <p className="mt-1 text-sm text-slate-600">
                Chọn chủ đề, trình độ và số câu hỏi trong mục “Luyện nhanh theo chủ đề” rồi bấm
                “Luyện theo chủ đề từ ngân hàng câu hỏi”. Kết quả sẽ được chấm điểm phía máy chủ và
                cập nhật trực tiếp vào SkillProfile.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
