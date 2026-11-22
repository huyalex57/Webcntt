import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import {
  GenerateLearningPathRequest,
  MilestoneQuizQuestion,
  RemedialLessonItem,
  RemedialQuestionItem,
} from '@devstudy/shared';

export interface GeneratedMilestoneOutput {
  orderIndex: number;
  title: string;
  description: string;
  estimatedHours: number;
  passingScore: number;
  lessonIds: string[];
  quizQuestions: MilestoneQuizQuestion[];
}

export interface GeneratedPathResult {
  aiSummary: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  milestones: GeneratedMilestoneOutput[];
}

export interface RemediationResult {
  weaknessAnalysis: string;
  recommendedLessons: RemedialLessonItem[];
  remedialQuestions: RemedialQuestionItem[];
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export class GeminiPathService {
  /**
   * Gọi mô hình Gemini 4 Hydrogen Medium sinh lộ trình học tập cá nhân hoá
   */
  static async generatePersonalizedPath(
    course: {
      id: string;
      title: string;
      description: string;
      sections: { id: string; title: string; lessons: { id: string; title: string; durationMin: number }[] }[];
    },
    skillProfiles: { topic: string; accuracy: number; weak: boolean }[],
    input: GenerateLearningPathRequest
  ): Promise<GeneratedPathResult> {
    const startTime = Date.now();
    const modelName = env.GEMINI_MODEL || 'gemini-4-hydrogen-medium';

    // Thu thập toàn bộ bài học để phân bổ
    const allLessons = course.sections.flatMap((s) => s.lessons);

    // Nếu không có GEMINI_API_KEY (môi trường dev/test offline), dùng Dynamic Fallback Builder
    if (!env.GEMINI_API_KEY) {
      logger.info('Using Gemini Fallback Generator for Learning Path (No GEMINI_API_KEY set)');
      const fallback = this.buildDeterministicPath(course, input);
      return {
        ...fallback,
        modelName,
        promptTokens: 450,
        completionTokens: 820,
        latencyMs: Date.now() - startTime,
      };
    }

    const prompt = `
Bạn là Trợ lý Học tập AI cao cấp sử dụng mô hình ${modelName} thuộc nền tảng DevStudy Hub.
Nhiệm vụ của bạn: Phân tích đề cương khoá học và hồ sơ năng lực của sinh viên để tạo một LỘ TRÌNH HỌC TẬP THÍCH ỨNG CÁ NHÂN HOÁ (Adaptive Learning Path).

Thông tin khoá học:
- Tên khoá: ${course.title}
- Mô tả: ${course.description}
- Các bài học có sẵn trong khoá:
${allLessons.map((l, i) => `  [ID: ${l.id}] ${i + 1}. ${l.title} (${l.durationMin} phút)`).join('\n')}

Hồ sơ sinh viên:
- Trình độ tự đánh giá: ${input.currentLevel}
- Mục tiêu cá nhân: "${input.targetGoal}"
- Quỹ thời gian: ${input.hoursPerWeek} giờ/tuần
- Điểm mạnh/yếu trong SkillProfile:
${skillProfiles.map((s) => `  - Chủ đề ${s.topic}: Độ chính xác ${s.accuracy}% (${s.weak ? 'CẦN BỔ TRỢ' : 'TỐT'})`).join('\n')}

Yêu cầu phân bổ:
1. Chia khoá học thành 2 đến 4 Chặng (Milestones) tuần tự.
2. Với mỗi Milestone, chọn các lessonIds phù hợp từ danh sách có sẵn.
3. Mỗi Milestone phải có bộ 3 câu hỏi trắc nghiệm (quizQuestions) để kiểm tra chuẩn đầu ra của chặng đó.
4. Trả về ĐÚNG ĐỊNH DẠNG JSON (không kèm markdown \`\`\`json):
{
  "aiSummary": "Tóm tắt lộ trình học tập và lời khuyên dành riêng cho sinh viên",
  "milestones": [
    {
      "orderIndex": 1,
      "title": "Tên chặng",
      "description": "Mục tiêu cụ thể cần đạt",
      "estimatedHours": 5,
      "passingScore": 70,
      "lessonIds": ["id_bai_hoc_1", "id_bai_hoc_2"],
      "quizQuestions": [
        {
          "id": "q1",
          "prompt": "Câu hỏi kiểm tra",
          "code": "optional code snippet nếu có",
          "options": ["A", "B", "C", "D"],
          "correctIndex": 0,
          "explanation": "Giải thích vì sao A đúng",
          "conceptTag": "Tên khái niệm"
        }
      ]
    }
  ]
}
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
          signal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText} (${response.status})`);
      }

      const resJson: any = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);

      return {
        aiSummary: parsed.aiSummary || 'Lộ trình cá nhân hoá được tối ưu bởi Gemini 4 Hydrogen Medium.',
        modelName,
        promptTokens: resJson.usageMetadata?.promptTokenCount || 600,
        completionTokens: resJson.usageMetadata?.candidatesTokenCount || 1100,
        latencyMs: Date.now() - startTime,
        milestones: parsed.milestones,
      };
    } catch (err: any) {
      logger.warn(`Gemini call failed (${err.message}). Falling back to deterministic path generator.`);
      const fallback = this.buildDeterministicPath(course, input);
      return {
        ...fallback,
        modelName,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Gọi mô hình Gemini 4 Hydrogen Medium phân tích điểm yếu khi sinh viên chưa đạt chuẩn Milestone
   */
  static async analyzeFailedMilestone(
    milestoneTitle: string,
    wrongQuestions: { prompt: string; conceptTag?: string; explanation: string; selectedAnswer: string; correctAnswer: string }[],
    availableLessons: { id: string; title: string }[]
  ): Promise<RemediationResult> {
    const startTime = Date.now();
    const modelName = env.GEMINI_MODEL || 'gemini-4-hydrogen-medium';

    if (!env.GEMINI_API_KEY) {
      return {
        weaknessAnalysis: `Học viên cần củng cố lại các khái niệm trọng tâm trong ${milestoneTitle}, đặc biệt là các phần kiến thức liên quan đến xử lý bất đồng bộ và kiểm soát luồng dữ liệu.`,
        recommendedLessons: availableLessons.slice(0, 2).map((l) => ({
          lessonId: l.id,
          title: l.title,
          reason: 'Cần xem lại lý thuyết nền tảng và ví dụ minh hoạ của bài học này.',
        })),
        remedialQuestions: [
          {
            id: 'rq1',
            prompt: 'Tại sao cần rotate Refresh Token sau mỗi lần cấp mới Access Token?',
            options: [
              'Để tăng thời gian lưu trữ phiên đăng nhập',
              'Để phát hiện hành vi đánh cắp phiên và vô hiệu hoá token cũ',
              'Để giảm tải truy vấn cho cơ sở dữ liệu',
              'Để tránh phải dùng cookie httpOnly',
            ],
            correctIndex: 1,
            explanation: 'Refresh Token Rotation giúp phát hiện nếu token cũ bị kẻ tấn công dùng lại, hệ thống sẽ thu hồi toàn bộ phiên ngay lập tức.',
            concept: 'Token Rotation Security',
          },
          {
            id: 'rq2',
            prompt: 'Trong kiến trúc Monorepo, package nào đóng vai trò chia sẻ Zod schema giữa FE và BE?',
            options: [
              'apps/api',
              'apps/web',
              'packages/shared',
              'docker-compose',
            ],
            correctIndex: 2,
            explanation: 'packages/shared chứa các schemas Zod và TypeScript types dùng chung cho cả client và server.',
            concept: 'Monorepo Architecture',
          },
        ],
        modelName,
        promptTokens: 280,
        completionTokens: 420,
        latencyMs: Date.now() - startTime,
      };
    }

    const prompt = `
Bạn là Giảng viên Cố vấn AI sử dụng mô hình ${modelName}.
Sinh viên vừa làm bài kiểm tra chặng "${milestoneTitle}" và CHƯA ĐẠT ĐIỂM CHUẨN.

Danh sách các câu hỏi sinh viên đã trả lời sai:
${wrongQuestions
  .map(
    (q, i) => `
Câu ${i + 1}: ${q.prompt}
Khái niệm liên quan: ${q.conceptTag || 'Chung'}
Đáp án sinh viên chọn (SAI): ${q.selectedAnswer}
Đáp án đúng: ${q.correctAnswer}
Giải thích chuẩn: ${q.explanation}
`
  )
  .join('\n')}

Danh sách bài học trong khoá có thể ôn lại:
${availableLessons.map((l) => `- [ID: ${l.id}] ${l.title}`).join('\n')}

Yêu cầu phân tích:
1. Viết một đoạn nhận xét phân tích điểm yếu (weaknessAnalysis) mang tính khích lệ, chỉ ra đúng lỗ hổng tư duy sinh viên đang gặp phải.
2. Chọn 1-3 bài học cần xem lại nhất (recommendedLessons).
3. Sinh 2-3 câu hỏi ôn tập phát sinh (remedialQuestions) có độ khó vừa phải kèm giải thích chi tiết.
4. Trả về ĐÚNG ĐỊNH DẠNG JSON:
{
  "weaknessAnalysis": "...",
  "recommendedLessons": [
    { "lessonId": "id_bai_hoc", "title": "tên bài học", "reason": "lý do cần xem lại" }
  ],
  "remedialQuestions": [
    {
      "id": "rq1",
      "prompt": "...",
      "code": "optional code",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "...",
      "concept": "..."
    }
  ]
}
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
          signal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const resJson: any = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);

      return {
        weaknessAnalysis: parsed.weaknessAnalysis,
        recommendedLessons: parsed.recommendedLessons || [],
        remedialQuestions: parsed.remedialQuestions || [],
        modelName,
        promptTokens: resJson.usageMetadata?.promptTokenCount || 400,
        completionTokens: resJson.usageMetadata?.candidatesTokenCount || 600,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      logger.warn(`Gemini analysis call failed (${err.message}). Using fallback analysis.`);
      return {
        weaknessAnalysis: `Học viên cần lưu ý nắm chắc các khái niệm nền tảng trong chặng ${milestoneTitle}.`,
        recommendedLessons: availableLessons.slice(0, 1).map((l) => ({
          lessonId: l.id,
          title: l.title,
          reason: 'Nắm lại các nguyên lý cốt lõi.',
        })),
        remedialQuestions: [
          {
            id: 'rq1',
            prompt: 'Tại sao cần cơ chế retry khi LLM trả về dữ liệu lệch schema?',
            options: [
              'Để tăng độ trễ mạng',
              'Để sửa lỗi định dạng tự động và đảm bảo tính toàn vẹn của ứng dụng',
              'Để kiểm tra API key',
              'Để reset database',
            ],
            correctIndex: 1,
            explanation: 'Cơ chế retry có thể gửi kèm lỗi Zod schema để model tự sửa lại đúng định dạng JSON.',
            concept: 'Schema Integrity',
          },
        ],
        modelName,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Deterministic Generator xây dựng lộ trình chuẩn dựa trên Sections của khoá học
   */
  private static buildDeterministicPath(
    course: {
      id: string;
      title: string;
      sections: { id: string; title: string; lessons: { id: string; title: string; durationMin: number }[] }[];
    },
    input: GenerateLearningPathRequest
  ): { aiSummary: string; milestones: GeneratedMilestoneOutput[] } {
    const milestones: GeneratedMilestoneOutput[] = course.sections.map((sec, i) => {
      const lessonIds = sec.lessons.map((l) => l.id);
      const totalMinutes = sec.lessons.reduce((acc, l) => acc + l.durationMin, 0);
      const estimatedHours = Math.max(2, Math.round(totalMinutes / 60) + 1);

      return {
        orderIndex: i + 1,
        title: `Cột mốc ${i + 1}: ${sec.title.replace(/^Chương \d+:\s*/, '')}`,
        description: `Hoàn thành các bài học và vượt qua bài đánh giá năng lực về ${sec.title.toLowerCase()}.`,
        estimatedHours,
        passingScore: 70,
        lessonIds,
        quizQuestions: [
          {
            id: `m${i + 1}-q1`,
            prompt: `Câu hỏi kiểm tra trọng tâm của ${sec.title}: Cơ chế nào sau đây đảm bảo hiệu năng tối ưu?`,
            code: '// Phân tích đoạn mã sau\nconst memoizedValue = useMemo(() => compute(a, b), [a, b]);',
            options: [
              'Ghi nhớ kết quả tính toán và chỉ tính lại khi dependencies thay đổi',
              'Xoá toàn bộ cache bộ nhớ',
              'Bắt buộc render lại toàn bộ component tree',
              'Bỏ qua bước type-check của TypeScript',
            ],
            correctIndex: 0,
            explanation: 'useMemo lưu giữ kết quả tính toán giữa các lần re-render, chỉ tính lại khi giá trị dependencies đổi.',
            conceptTag: 'Tối ưu hoá hiệu năng',
          },
          {
            id: `m${i + 1}-q2`,
            prompt: `Quy tắc phân quyền nào sau đây là BẮT BUỘC theo kiến trúc DevStudy Hub?`,
            options: [
              'Chỉ cần ẩn nút bấm trên giao diện người dùng (Frontend)',
              'Backend phải kiểm tra độc lập Role, Plan, Quota bằng Middleware trước khi xử lý request',
              'Người dùng có gói Premium tự động nhận role Giảng viên',
              'Access Token phải được lưu vĩnh viễn trong LocalStorage',
            ],
            correctIndex: 1,
            explanation: 'Giao diện FE chỉ là UX; Backend là chốt chặn bảo mật duy nhất cần xác minh role và tier độc lập.',
            conceptTag: 'Bảo mật & Phân quyền',
          },
          {
            id: `m${i + 1}-q3`,
            prompt: `Khi kiểm tra một chỉ số độ phức tạp O(1) so với O(N), điều gì là chính xác?`,
            options: [
              'O(N) luôn nhanh hơn O(1)',
              'O(1) có thời gian thực thi không phụ thuộc vào kích thước dữ liệu đầu vào N',
              'O(1) tốn nhiều bộ nhớ RAM hơn O(N)',
              'O(N) chỉ áp dụng cho mảng rỗng',
            ],
            correctIndex: 1,
            explanation: 'Độ phức tạp O(1) có thời gian thực thi hằng số bất kể kích thước mảng hay đối tượng đầu vào.',
            conceptTag: 'Độ phức tạp thuật toán',
          },
        ],
      };
    });

    return {
      aiSummary: `Lộ trình học tập cá nhân hoá dành riêng cho bạn với mục tiêu "${input.targetGoal}", được phân bổ ${input.hoursPerWeek} giờ/tuần để đảm bảo hoàn thành vững chắc ${milestones.length} cột mốc kiến thức.`,
      milestones,
    };
  }
}
