import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiPathService, cleanJson } from '../modules/learning-path/gemini-path.service.js';
import { env } from '../config/env.js';

describe('Gemini AI Service Unit & Integration Tests (gemini-4-hydrogen-medium)', () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = env.GEMINI_API_KEY;
  const originalModel = env.GEMINI_MODEL;

  const mockCourse = {
    id: 'c1',
    title: 'Lập trình Web Fullstack với React & Node.js',
    description: 'Khoá học toàn diện về Web hiện đại',
    sections: [
      {
        id: 'sec-1',
        title: 'Chương 1: Kiến trúc React & Hooks',
        lessons: [
          { id: 'l1', title: 'Component Lifecycle & useState', durationMin: 30 },
          { id: 'l2', title: 'useEffect, useMemo & useCallback', durationMin: 45 },
        ],
      },
      {
        id: 'sec-2',
        title: 'Chương 2: REST API & JWT Security',
        lessons: [
          { id: 'l3', title: 'Express Middleware & Routing', durationMin: 40 },
          { id: 'l4', title: 'JWT Refresh Token Rotation & Cookie', durationMin: 50 },
        ],
      },
    ],
  };

  const mockSkillProfiles = [
    { topic: 'REACT', accuracy: 85, weak: false },
    { topic: 'NODEJS', accuracy: 40, weak: true },
  ];

  const mockInput = {
    targetGoal: 'Nắm vững kiến trúc Fullstack để hoàn thành đồ án tốt nghiệp',
    currentLevel: 'TRUNG_BINH' as const,
    hoursPerWeek: 12,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    env.GEMINI_API_KEY = originalApiKey;
    env.GEMINI_MODEL = originalModel;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    env.GEMINI_API_KEY = originalApiKey;
    env.GEMINI_MODEL = originalModel;
  });

  describe('1. JSON Sanitization & Markdown Stripping (cleanJson)', () => {
    it('Lọc bỏ code block ```json ... ``` đúng chuẩn', () => {
      const input = '```json\n{"aiSummary": "Tốt", "milestones": []}\n```';
      const output = cleanJson(input);
      expect(output).toBe('{"aiSummary": "Tốt", "milestones": []}');
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('Lọc bỏ code block generic ``` ... ``` và khoảng trắng thừa', () => {
      const input = '  ```\n{"success": true}\n```  ';
      const output = cleanJson(input);
      expect(output).toBe('{"success": true}');
      expect(JSON.parse(output).success).toBe(true);
    });

    it('Giữ nguyên chuỗi JSON thuần tuý', () => {
      const input = '{"key": "value"}';
      expect(cleanJson(input)).toBe(input);
    });

    it('Xử lý chuỗi rỗng an toàn', () => {
      expect(cleanJson('')).toBe('{}');
    });
  });

  describe('2. Deterministic Fallback Generator (Khi offline hoặc không có API Key)', () => {
    it('Tự động tạo lộ trình đầy đủ chặng và câu hỏi trắc nghiệm khi không có GEMINI_API_KEY', async () => {
      env.GEMINI_API_KEY = '';

      const result = await GeminiPathService.generatePersonalizedPath(
        mockCourse,
        mockSkillProfiles,
        mockInput
      );

      expect(result).toBeDefined();
      expect(result.modelName).toBe('gemini-4-hydrogen-medium');
      expect(result.milestones.length).toBe(2);
      expect(result.aiSummary).toContain('Lộ trình học tập cá nhân hoá dành riêng cho bạn');

      // Kiểm tra chặng 1
      const m1 = result.milestones[0];
      expect(m1.orderIndex).toBe(1);
      expect(m1.title).toContain('Kiến trúc React & Hooks');
      expect(m1.lessonIds).toEqual(['l1', 'l2']);
      expect(m1.passingScore).toBe(70);
      expect(m1.quizQuestions.length).toBe(3);

      // Kiểm tra câu hỏi trắc nghiệm
      const q1 = m1.quizQuestions[0];
      expect(q1.prompt).toBeDefined();
      expect(q1.options.length).toBe(4);
      expect(q1.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q1.correctIndex).toBeLessThan(4);
      expect(q1.explanation).toBeDefined();
    });

    it('Tự động tạo kế hoạch ôn tập (Remediation) dự phòng khi không có GEMINI_API_KEY', async () => {
      env.GEMINI_API_KEY = '';

      const wrongQuestions = [
        {
          prompt: 'Tại sao cần rotate Refresh Token?',
          conceptTag: 'JWT Security',
          explanation: 'Để chống replay attack',
          selectedAnswer: 'Để giảm bộ nhớ',
          correctAnswer: 'Để phát hiện đánh cắp phiên',
        },
      ];

      const availableLessons = [
        { id: 'l4', title: 'JWT Refresh Token Rotation & Cookie' },
      ];

      const result = await GeminiPathService.analyzeFailedMilestone(
        'Cột mốc 2: REST API & JWT Security',
        wrongQuestions,
        availableLessons
      );

      expect(result).toBeDefined();
      expect(result.weaknessAnalysis).toContain('Học viên cần củng cố lại');
      expect(result.recommendedLessons.length).toBeGreaterThan(0);
      expect(result.remedialQuestions.length).toBeGreaterThan(0);
      expect(result.remedialQuestions[0].options.length).toBe(4);
    });
  });

  describe('3. Tích hợp Gemini 4 Hydrogen Medium API (Live / Mocked API Call)', () => {
    it('Xử lý thành công phản hồi từ Gemini API với cấu trúc JSON chuẩn', async () => {
      env.GEMINI_API_KEY = 'test-gemini-api-key-12345';

      const mockGeminiApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    aiSummary: 'Lộ trình tối ưu hoá bởi Gemini 4 Hydrogen Medium theo mục tiêu đồ án tốt nghiệp.',
                    milestones: [
                      {
                        orderIndex: 1,
                        title: 'Nền tảng Fullstack & State Management',
                        description: 'Nắm vững kiến trúc component và state flow.',
                        estimatedHours: 6,
                        passingScore: 75,
                        lessonIds: ['l1', 'l2'],
                        quizQuestions: [
                          {
                            id: 'q1',
                            prompt: 'Khi nào nên sử dụng useCallback trong React?',
                            code: 'const fn = useCallback(() => doSomething(), []);',
                            options: [
                              'Khi muốn tránh re-create function reference truyền xuống component con',
                              'Khi muốn component không bao giờ re-render',
                              'Để thay thế hoàn toàn Redux',
                              'Để gọi API bất đồng bộ',
                            ],
                            correctIndex: 0,
                            explanation: 'useCallback ghi nhớ instance của function giữa các lần re-render.',
                            conceptTag: 'Performance Optimization',
                          },
                        ],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 520,
          candidatesTokenCount: 890,
          totalTokenCount: 1410,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGeminiApiResponse,
      } as any);

      const result = await GeminiPathService.generatePersonalizedPath(
        mockCourse,
        mockSkillProfiles,
        mockInput
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = (globalThis.fetch as any).mock.calls[0];
      expect(calledUrl).toContain('models/gemini-4-hydrogen-medium:generateContent');
      expect(calledUrl).toContain('key=test-gemini-api-key-12345');
      expect(calledInit.method).toBe('POST');

      expect(result.aiSummary).toBe('Lộ trình tối ưu hoá bởi Gemini 4 Hydrogen Medium theo mục tiêu đồ án tốt nghiệp.');
      expect(result.promptTokens).toBe(520);
      expect(result.completionTokens).toBe(890);
      expect(result.milestones.length).toBe(1);
      expect(result.milestones[0].passingScore).toBe(75);
    });

    it('Xử lý thành công phản hồi bọc trong markdown ```json từ Gemini API', async () => {
      env.GEMINI_API_KEY = 'test-gemini-api-key-12345';

      const mockGeminiMarkdownResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n' + JSON.stringify({
                    aiSummary: 'Lộ trình được bọc trong markdown fences từ LLM.',
                    milestones: [
                      {
                        orderIndex: 1,
                        title: 'Chặng 1: Xử lý Markdown',
                        description: 'Kiểm tra độ bền bỉ của parser',
                        estimatedHours: 4,
                        passingScore: 70,
                        lessonIds: ['l1'],
                        quizQuestions: [],
                      },
                    ],
                  }) + '\n```',
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 400,
          candidatesTokenCount: 600,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGeminiMarkdownResponse,
      } as any);

      const result = await GeminiPathService.generatePersonalizedPath(
        mockCourse,
        mockSkillProfiles,
        mockInput
      );

      expect(result.aiSummary).toBe('Lộ trình được bọc trong markdown fences từ LLM.');
      expect(result.milestones[0].title).toBe('Chặng 1: Xử lý Markdown');
    });

    it('Tự động kích hoạt Fallback khi Gemini API trả về lỗi HTTP 500 / 429 hoặc lỗi mạng', async () => {
      env.GEMINI_API_KEY = 'test-gemini-api-key-12345';

      // Mock API lỗi 503 Service Unavailable
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as any);

      const result = await GeminiPathService.generatePersonalizedPath(
        mockCourse,
        mockSkillProfiles,
        mockInput
      );

      // Hệ thống không bị crash, mà tự động chuyển sang fallback an toàn
      expect(result).toBeDefined();
      expect(result.milestones.length).toBe(2);
      expect(result.aiSummary).toContain('Lộ trình học tập cá nhân hoá dành riêng cho bạn');
    });

    it('Phân tích bài làm sai và sinh Remediation thành công từ Gemini API', async () => {
      env.GEMINI_API_KEY = 'test-gemini-api-key-12345';

      const mockRemediationApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    weaknessAnalysis: 'Bạn đang bị nhầm lẫn giữa Access Token và Refresh Token trong luồng Rotation.',
                    recommendedLessons: [
                      {
                        lessonId: 'l4',
                        title: 'JWT Refresh Token Rotation & Cookie',
                        reason: 'Cần xem lại cơ chế thu hồi token cũ khi bị tái sử dụng.',
                      },
                    ],
                    remedialQuestions: [
                      {
                        id: 'rq-live-1',
                        prompt: 'Mục đích chính của HttpOnly Cookie khi lưu Refresh Token là gì?',
                        options: [
                          'Chống tấn công XSS đọc trộm token bằng JavaScript',
                          'Tăng tốc độ nén dữ liệu',
                          'Cho phép truy cập từ mọi domain mà không cần CORS',
                          'Thay thế hoàn toàn HTTPS',
                        ],
                        correctIndex: 0,
                        explanation: 'Cookie HttpOnly không thể truy cập qua document.cookie nên miễn nhiễm với đánh cắp qua XSS thông thường.',
                        concept: 'Web Security',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 310,
          candidatesTokenCount: 450,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRemediationApiResponse,
      } as any);

      const result = await GeminiPathService.analyzeFailedMilestone(
        'REST API & JWT Security',
        [
          {
            prompt: 'Refresh Token Rotation hoạt động như thế nào?',
            selectedAnswer: 'Dùng token cũ mãi mãi',
            correctAnswer: 'Cấp token mới và huỷ token cũ',
            explanation: 'Rotation ngăn ngừa tái sử dụng token',
          },
        ],
        [{ id: 'l4', title: 'JWT Refresh Token Rotation & Cookie' }]
      );

      expect(result.weaknessAnalysis).toBe('Bạn đang bị nhầm lẫn giữa Access Token và Refresh Token trong luồng Rotation.');
      expect(result.recommendedLessons.length).toBe(1);
      expect(result.remedialQuestions.length).toBe(1);
      expect(result.remedialQuestions[0].id).toBe('rq-live-1');
      expect(result.promptTokens).toBe(310);
      expect(result.completionTokens).toBe(450);
    });
  });
});
