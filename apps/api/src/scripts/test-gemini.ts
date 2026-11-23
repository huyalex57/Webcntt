import { GeminiPathService } from '../modules/learning-path/gemini-path.service.js';
import { env } from '../config/env.js';

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 KIỂM THỬ DỊCH VỤ AI GEMINI (Model: ' + (env.GEMINI_MODEL || 'gemini-4-hydrogen-medium') + ')');
  console.log('='.repeat(70));
  console.log(`📌 Môi trường cấu hình:`);
  console.log(`   - GEMINI_MODEL: ${env.GEMINI_MODEL}`);
  console.log(`   - GEMINI_API_KEY: ${env.GEMINI_API_KEY ? 'ĐÃ CẤU HÌNH (***' + env.GEMINI_API_KEY.slice(-4) + ')' : 'CHƯA CẤU HÌNH (Dùng Dynamic Fallback Engine)'}`);
  console.log(`   - GEMINI_TIMEOUT_MS: ${env.GEMINI_TIMEOUT_MS} ms`);
  console.log();

  const mockCourse = {
    id: 'c1',
    title: 'Lập trình Web Fullstack với React, Node.js & PostgreSQL',
    description: 'Xây dựng ứng dụng web hoàn chỉnh: React + TypeScript, REST API với Express, JWT auth, Prisma và deploy.',
    sections: [
      {
        id: 'sec-1',
        title: 'Chương 1: Nền tảng React & Clean Architecture',
        lessons: [
          { id: 'l1', title: 'React 18 Component Lifecycle & Hooks cơ bản', durationMin: 35 },
          { id: 'l2', title: 'Quản lý state với TanStack Query & Context API', durationMin: 45 },
          { id: 'l3', title: 'Tối ưu hoá render với useMemo, useCallback & Profiler', durationMin: 40 },
        ],
      },
      {
        id: 'sec-2',
        title: 'Chương 2: Xây dựng RESTful API & Bảo mật với Express 5',
        lessons: [
          { id: 'l4', title: 'Thiết kế REST API chuẩn OpenAPI và kiến trúc Controller-Service', durationMin: 45 },
          { id: 'l5', title: 'Cơ chế xác thực JWT kép (Access Token in-memory + Refresh Token Rotation)', durationMin: 60 },
          { id: 'l6', title: 'Phân quyền độc lập RBAC Role & Plan Tier với Express Middleware', durationMin: 50 },
        ],
      },
      {
        id: 'sec-3',
        title: 'Chương 3: Cơ sở dữ liệu PostgreSQL & ORM Prisma',
        lessons: [
          { id: 'l7', title: 'Thiết kế lược đồ ERD, quan hệ 1-N, N-N và chỉ mục tối ưu', durationMin: 50 },
          { id: 'l8', title: 'Prisma Client, Migration và Seed dữ liệu chuẩn hoá', durationMin: 45 },
        ],
      },
    ],
  };

  const studentProfile = [
    { topic: 'Frontend React', accuracy: 82, weak: false },
    { topic: 'Bảo mật JWT', accuracy: 45, weak: true },
    { topic: 'PostgreSQL & DB', accuracy: 50, weak: true },
  ];

  const studentRequest = {
    targetGoal: 'Học chắc kiến trúc backend REST API và cơ chế bảo mật JWT để đạt điểm A đồ án chuyên ngành CNTT',
    currentLevel: 'TRUNG_BINH' as const,
    hoursPerWeek: 10,
  };

  console.log('📚 [BƯỚC 1] GỬI YÊU CẦU SINH LỘ TRÌNH HỌC TẬP THÍCH ỨNG:');
  console.log(`   - Mục tiêu: "${studentRequest.targetGoal}"`);
  console.log(`   - Trình độ: ${studentRequest.currentLevel}`);
  console.log(`   - Quỹ thời gian: ${studentRequest.hoursPerWeek} giờ/tuần`);
  console.log(`   - Điểm yếu cần bổ trợ: Bảo mật JWT (45%), PostgreSQL & DB (50%)`);
  console.log();

  const startTime = Date.now();
  const pathResult = await GeminiPathService.generatePersonalizedPath(
    mockCourse,
    studentProfile,
    studentRequest
  );
  const totalDuration = Date.now() - startTime;

  console.log('✅ [KẾT QUẢ SINH LỘ TRÌNH]:');
  console.log(`   - Tóm tắt AI: ${pathResult.aiSummary}`);
  console.log(`   - Model thực thi: ${pathResult.modelName}`);
  console.log(`   - Token ước tính: ${pathResult.promptTokens} prompt tokens / ${pathResult.completionTokens} completion tokens`);
  console.log(`   - Thời gian xử lý: ${totalDuration} ms`);
  console.log();
  console.log(`   - Danh sách ${pathResult.milestones.length} Cột mốc (Milestones):`);

  pathResult.milestones.forEach((m, idx) => {
    console.log(`     📍 Cột mốc ${m.orderIndex}: ${m.title}`);
    console.log(`        - Mô tả: ${m.description}`);
    console.log(`        - Thời lượng: ${m.estimatedHours} giờ (Điểm đạt chuẩn: ${m.passingScore}%)`);
    console.log(`        - Bài học liên kết: ${m.lessonIds.join(', ')}`);
    console.log(`        - Câu hỏi trắc nghiệm kiểm định (${m.quizQuestions.length} câu):`);
    m.quizQuestions.forEach((q, qIdx) => {
      console.log(`          [Q${qIdx + 1}] ${q.prompt}`);
      q.options.forEach((opt, oIdx) => {
        const marker = oIdx === q.correctIndex ? ' (✓ ĐÚNG)' : '';
        console.log(`             ${String.fromCharCode(65 + oIdx)}. ${opt}${marker}`);
      });
      console.log(`             💡 Giải thích: ${q.explanation}`);
    });
    console.log();
  });

  console.log('-'.repeat(70));
  console.log('🧪 [BƯỚC 2] KIỂM THỬ PHÂN TÍCH ĐIỂM YẾU KHI SINH VIÊN CHƯA ĐẠT CHUẨN:');
  console.log('   Giả lập sinh viên làm bài kiểm tra Cột mốc 2 bị điểm thấp (chọn sai 2/3 câu)...');
  console.log();

  const wrongQuestions = [
    {
      prompt: 'Quy tắc phân quyền nào sau đây là BẮT BUỘC theo kiến trúc DevStudy Hub?',
      conceptTag: 'Bảo mật & Phân quyền',
      selectedAnswer: 'Chỉ cần ẩn nút bấm trên giao diện người dùng (Frontend)',
      correctAnswer: 'Backend phải kiểm tra độc lập Role, Plan, Quota bằng Middleware trước khi xử lý request',
      explanation: 'Giao diện FE chỉ là UX; Backend là chốt chặn bảo mật duy nhất cần xác minh role và tier độc lập.',
    },
    {
      prompt: 'Tại sao cần rotate Refresh Token sau mỗi lần cấp mới Access Token?',
      conceptTag: 'Token Rotation Security',
      selectedAnswer: 'Để giảm tải truy vấn cho cơ sở dữ liệu',
      correctAnswer: 'Để phát hiện hành vi đánh cắp phiên và vô hiệu hoá token cũ',
      explanation: 'Refresh Token Rotation giúp phát hiện nếu token cũ bị kẻ tấn công dùng lại, hệ thống sẽ thu hồi toàn bộ phiên ngay lập tức.',
    },
  ];

  const availableLessons = [
    { id: 'l5', title: 'Cơ chế xác thực JWT kép (Access Token in-memory + Refresh Token Rotation)' },
    { id: 'l6', title: 'Phân quyền độc lập RBAC Role & Plan Tier với Express Middleware' },
  ];

  const remediationResult = await GeminiPathService.analyzeFailedMilestone(
    'Cột mốc 2: Xây dựng RESTful API & Bảo mật với Express 5',
    wrongQuestions,
    availableLessons
  );

  console.log('✅ [KẾT QUẢ PHÂN TÍCH THÍCH ỨNG (REMEDIATION)]:');
  console.log(`   - Nhận xét phân tích: ${remediationResult.weaknessAnalysis}`);
  console.log(`   - Bài học AI khuyến nghị xem lại:`);
  remediationResult.recommendedLessons.forEach((rec) => {
    console.log(`     📖 [${rec.lessonId}] ${rec.title} -> Lý do: ${rec.reason}`);
  });
  console.log(`   - Câu hỏi ôn tập phát sinh (${remediationResult.remedialQuestions.length} câu):`);
  remediationResult.remedialQuestions.forEach((rq, idx) => {
    console.log(`     [RQ${idx + 1}] ${rq.prompt} (Khái niệm: ${rq.concept})`);
    rq.options.forEach((opt, oIdx) => {
      const marker = oIdx === rq.correctIndex ? ' (✓ ĐÚNG)' : '';
      console.log(`        ${String.fromCharCode(65 + oIdx)}. ${opt}${marker}`);
    });
    console.log(`        💡 Lời giải: ${rq.explanation}`);
  });

  console.log();
  console.log('='.repeat(70));
  console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ DỊCH VỤ AI GEMINI ĐÃ HOÀN TẤT THÀNH CÔNG 100%!');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
