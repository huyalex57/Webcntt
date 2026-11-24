import { expect, test, type Page, type Response } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE_URL || 'http://localhost:4000/api/v1';

interface RuntimeErrorTracker {
  consoleErrors: string[];
  pageErrors: string[];
  failedApiRequests: string[];
  assertClean: (opts?: { allowStatuses?: number[] }) => void;
}

/**
 * Theo dõi toàn bộ console.error, uncaught pageerror và HTTP >= 400 từ API
 * trong suốt thời gian chạy mỗi test case.
 */
function trackRuntimeErrors(page: Page): RuntimeErrorTracker {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedApiRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('response', (res: Response) => {
    const url = res.url();
    if (url.startsWith(API_BASE) && res.status() >= 400) {
      failedApiRequests.push(`${res.request().method()} ${url} -> ${res.status()}`);
    }
  });

  return {
    consoleErrors,
    pageErrors,
    failedApiRequests,
    assertClean(opts?: { allowStatuses?: number[] }) {
      const allowed = new Set(opts?.allowStatuses ?? []);
      const unexpectedApiErrors = failedApiRequests.filter((entry) => {
        const statusMatch = entry.match(/-> (\d+)$/);
        const status = statusMatch ? Number(statusMatch[1]) : 0;
        return !allowed.has(status);
      });

      expect(pageErrors, `Uncaught page errors: ${pageErrors.join('\n')}`).toEqual([]);
      expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
      expect(
        unexpectedApiErrors,
        `Unexpected API errors: ${unexpectedApiErrors.join('\n')}`
      ).toEqual([]);
    },
  };
}

/**
 * Chuyển tài khoản demo qua RoleSwitcher trên Header và chờ API login/logout hoàn tất.
 */
async function switchDemoRole(
  page: Page,
  roleKey: 'guest' | 'student-free' | 'student-premium' | 'lecturer-premium'
) {
  const switcher = page.getByLabel('Chọn role demo').first();
  await expect(switcher).toBeVisible();

  const waitAuth =
    roleKey === 'guest'
      ? page.waitForResponse((r) => r.url().includes('/auth/logout')).catch(() => null)
      : page.waitForResponse(
          (r) => r.url().includes('/auth/login') && r.request().method() === 'POST'
        );

  await switcher.selectOption(roleKey);
  const authRes = await waitAuth;
  if (roleKey !== 'guest' && authRes) {
    expect(authRes.status(), `Demo login failed for ${roleKey}`).toBe(200);
  }
}

/**
 * Đảm bảo module @devstudy/ai-review đang bật trước khi chạy suite AI Review.
 */
async function assertAiReviewEnabled(page: Page) {
  const res = await page.request.get(`${API_BASE}/ai-review/status`);
  expect(
    res.status(),
    'Backend API chưa bật AI_REVIEW_ENABLED=true (GET /api/v1/ai-review/status trả khác 200)'
  ).toBe(200);
  const json = await res.json();
  expect(json?.data?.enabled).toBe(true);
}

// ============================================================================
// SUITE 1: AI REVIEW & OPEN-SOURCE ROADMAPS (/practice)
// ============================================================================

test.describe('AI Review & Open-Source Roadmaps (/practice)', () => {
  test.beforeEach(async ({ page }) => {
    await assertAiReviewEnabled(page);
  });

  test('TC1: Hiển thị đủ Quota (format vi-VN), Phân tích điểm yếu & Lộ trình nguồn mở 0PL-1.0', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'student-premium');

    const statusPromise = page.waitForResponse((r) => r.url().includes('/ai-review/status'));
    const quotaPromise = page.waitForResponse((r) => r.url().includes('/ai-review/quota'));
    const recsPromise = page.waitForResponse((r) =>
      r.url().includes('/ai-review/recommendations')
    );

    await page.getByRole('link', { name: 'Luyện AI' }).click();
    await expect(page).toHaveURL(/\/practice$/);

    expect((await statusPromise).status()).toBe(200);
    expect((await quotaPromise).status()).toBe(200);
    expect((await recsPromise).status()).toBe(200);

    // 1. Quota Card & Sidebar copy đồng bộ, số lớn có dấu ngăn cách hàng nghìn vi-VN
    const quotaCard = page.getByTestId('ai-review-quota-card');
    await expect(quotaCard).toBeVisible();
    await expect(quotaCard).toContainText('Gói PREMIUM');
    await expect(quotaCard).toContainText('5.000.000');
    await expect(page.locator('aside')).toContainText('30 bộ đề AI/ngày');

    // 2. Panel AI Review + ghi chú giải thích khác biệt với SkillProfile
    const aiPanel = page.getByTestId('ai-review-panel');
    await expect(aiPanel).toBeVisible();
    await expect(aiPanel).toContainText(
      'Điểm thành thạo AI ưu tiên lịch sử trả lời gần đây'
    );

    // 3. Gợi ý Roadmap nguồn mở awesome-roadmaps (0PL-1.0)
    const roadmapCard = page.getByTestId('ai-roadmap-suggestions');
    await expect(roadmapCard).toBeVisible();
    await expect(roadmapCard).toContainText('Zero Public License 1.0');
    await expect(
      roadmapCard.getByRole('button', { name: 'Tạo đề 20 câu theo lộ trình này' }).first()
    ).toBeVisible();

    tracker.assertClean();
  });

  test('TC2: Phân tích AI & Kế hoạch ôn tập hiển thị tên chủ đề tiếng Việt và cập nhật token', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'student-premium');
    await page.getByRole('link', { name: 'Luyện AI' }).click();
    await expect(page.getByTestId('ai-review-panel')).toBeVisible();

    const summaryPromise = page.waitForResponse(
      (r) => r.url().includes('/ai-review/summary') && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: 'Phân tích AI & Kế hoạch ôn tập' }).click();
    const summaryRes = await summaryPromise;
    expect(summaryRes.status()).toBe(200);

    const summaryBox = page.getByTestId('ai-summary-result');
    await expect(summaryBox).toBeVisible();
    await expect(summaryBox).toContainText('Chẩn đoán theo chủ đề');
    await expect(summaryBox).toContainText('Kế hoạch ôn tập đề xuất');

    // Đảm bảo không in mã enum thô trong câu phân tích tiếng Việt
    const summaryText = await summaryBox.innerText();
    expect(summaryText).not.toMatch(/\b(HDH|AI_DS|CTDL|CSDL|WEB_CLOUD)\b/);

    tracker.assertClean();
  });

  test('TC3: Validation mục tiêu (< 3 ký tự), tạo bộ đề rule-based (0 token) & nộp bài chấm điểm từ server', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'student-premium');
    await page.getByRole('link', { name: 'Luyện AI' }).click();
    await expect(page.getByTestId('ai-review-panel')).toBeVisible();

    const goalInput = page.locator('#ai-review-goal');
    const createBtn = page.getByRole('button', {
      name: /Tạo đề ôn tập cá nhân hóa \(20 câu\)/i,
    });

    // Goal < 3 ký tự -> nút bị disable
    await goalInput.fill('ab');
    await expect(createBtn).toBeDisabled();

    // Goal hợp lệ >= 3 ký tự -> nút mở lại
    await goalInput.fill('Ôn tập CSDL & Hệ điều hành chuẩn bị thi cuối kỳ');
    await expect(createBtn).toBeEnabled();

    // Tắt AI ranking -> chạy rule-based thuần (0 token LLM)
    const useAiCheckbox = page.getByRole('checkbox', {
      name: /Dùng AI sắp xếp bộ đề/i,
    });
    if (await useAiCheckbox.isChecked()) {
      await useAiCheckbox.uncheck();
    }

    const createSetPromise = page.waitForResponse(
      (r) => r.url().includes('/ai-review/exam-sets') && r.request().method() === 'POST'
    );
    await createBtn.click();
    const createSetRes = await createSetPromise;
    expect(createSetRes.status()).toBe(201);

    const player = page.getByTestId('question-player');
    await expect(player).toBeVisible();
    await expect(player).toContainText('Đề cá nhân hóa (Rule-based)');
    await expect(player.getByTestId('question-reason-badge')).toBeVisible();

    // Chọn đáp án A cho câu đầu tiên rồi nộp bài
    await player.getByRole('button', { name: /^A\./ }).click();

    const submitPromise = page.waitForResponse(
      (r) => r.url().includes('/practice/attempts') && r.request().method() === 'POST'
    );
    await player.getByRole('button', { name: /Nộp bài/i }).click();
    expect((await submitPromise).status()).toBe(201);

    const resultView = page.getByTestId('practice-result-view');
    await expect(resultView).toBeVisible();
    await expect(resultView).toContainText('Kết quả:');
    await expect(resultView).toContainText('Giải thích:');

    tracker.assertClean();
  });

  test('TC4: Tạo đề từ thẻ Roadmap nguồn mở hiển thị lý do chọn câu & cảnh báo khi ít hơn 20 câu', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'student-premium');
    await page.getByRole('link', { name: 'Luyện AI' }).click();

    const roadmapSection = page.getByTestId('ai-roadmap-suggestions');
    await expect(roadmapSection).toBeVisible();

    // Thử tạo bộ đề từ 1 thẻ roadmap bất kỳ có câu hỏi khả dụng
    const roadmapButtons = roadmapSection.getByRole('button', {
      name: 'Tạo đề 20 câu theo lộ trình này',
    });
    const count = await roadmapButtons.count();
    expect(count).toBeGreaterThan(0);

    let openedPlayer = false;
    for (let i = 0; i < count; i++) {
      const createPromise = page.waitForResponse(
        (r) => r.url().includes('/ai-review/exam-sets') && r.request().method() === 'POST'
      );
      await roadmapButtons.nth(i).click();
      const createRes = await createPromise;
      expect(createRes.status()).toBe(201);

      const body = await createRes.json();
      const fulfilled: number = body?.data?.fulfilled ?? 0;

      if (fulfilled > 0) {
        openedPlayer = true;
        const player = page.getByTestId('question-player');
        await expect(player).toBeVisible();
        await expect(player.getByTestId('question-reason-badge')).toBeVisible();
        await expect(player).toContainText(`Câu 1 / ${fulfilled}`);

        if (fulfilled < 20) {
          await expect(player.getByTestId('session-warnings')).toBeVisible();
        }
        break;
      }
    }

    expect(openedPlayer, 'Cần ít nhất 1 roadmap trả về > 0 câu hỏi khả dụng').toBe(true);
    tracker.assertClean();
  });

  test('TC5: Đổi vai trò trực tiếp trên /practice (Premium -> Free -> Lecturer) không rò rỉ cache cũ', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'student-premium');
    await page.getByRole('link', { name: 'Luyện AI' }).click();
    await expect(page.getByTestId('ai-review-quota-card')).toContainText('Gói PREMIUM');

    // Tạo AI summary trước để kiểm tra local state có được reset khi đổi user không
    const summaryPromise = page.waitForResponse(
      (r) => r.url().includes('/ai-review/summary') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Phân tích AI & Kế hoạch ôn tập' }).click();
    expect((await summaryPromise).status()).toBe(200);
    await expect(page.getByTestId('ai-summary-result')).toBeVisible();

    // 1. Đổi trực tiếp STUDENT · Premium -> STUDENT · Free ngay trên /practice
    const freeQuotaPromise = page.waitForResponse((r) => r.url().includes('/ai-review/quota'));
    await switchDemoRole(page, 'student-free');
    expect((await freeQuotaPromise).status()).toBe(200);

    // Local aiSummary phải bị xoá, QuotaCard chuyển ngay sang Gói FREE (150.000)
    await expect(page.getByTestId('ai-summary-result')).toHaveCount(0);
    await expect(page.getByTestId('ai-review-quota-card')).toContainText('Gói FREE');
    await expect(page.getByTestId('ai-review-quota-card')).toContainText('150.000');
    await expect(page.locator('aside')).toContainText('3 bộ đề AI/ngày');

    // 2. Đổi trực tiếp STUDENT · Free -> LECTURER · Premium: ẩn mượt AI Review, 0 lỗi 403
    await switchDemoRole(page, 'lecturer-premium');
    await expect(page.getByTestId('ai-review-quota-card')).toHaveCount(0);
    await expect(page.getByTestId('ai-review-panel')).toHaveCount(0);
    await expect(page.getByTestId('skill-profile-card')).toBeVisible();

    tracker.assertClean();
  });

  test('TC6: Bộ lọc ngân hàng câu hỏi core thông báo rõ khi phải nới rộng phạm vi (không fallback im lặng)', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'lecturer-premium');
    await page.getByRole('link', { name: 'Luyện AI' }).click();

    // Chọn tổ hợp khắt khe không có câu hỏi: CTDL + Nâng cao + 10 câu + Tìm lỗi (debug)
    const configSelects = page.locator('main select');
    await configSelects.nth(0).selectOption('CTDL');
    await configSelects.nth(1).selectOption('NANG_CAO');
    await configSelects.nth(2).selectOption('10');
    await configSelects.nth(3).selectOption('DEBUG');

    await page
      .getByRole('button', { name: 'Luyện theo chủ đề từ ngân hàng câu hỏi' })
      .click();

    const player = page.getByTestId('question-player');
    await expect(player).toBeVisible();
    await expect(player.getByTestId('session-warnings')).toBeVisible();
    await expect(player.getByTestId('session-warnings')).toContainText(
      'hệ thống đã tự mở rộng sang toàn bộ câu hỏi đã duyệt của chủ đề này'
    );

    tracker.assertClean();
  });

  test('TC7: Mobile viewport (375x812) trên /practice không bị tràn ngang', async ({ page }) => {
    const tracker = trackRuntimeErrors(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.getByRole('button', { name: /Đăng nhập nhanh demo — STUDENT Free/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Điều hướng SPA qua mobile drawer để giữ phiên in-memory token
    await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
    await page.getByRole('link', { name: 'Luyện AI' }).click();
    await expect(page).toHaveURL(/\/practice$/);
    await expect(page.getByTestId('ai-review-panel')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);

    tracker.assertClean();
  });
});

// ============================================================================
// SUITE 2: ADAPTIVE AI LEARNING PATH / COURSE ROADMAP (/courses/:id)
// ============================================================================

test.describe('Adaptive AI Learning Path / Course Roadmap (/courses/:id)', () => {
  test('TC8: Tài khoản FREE trên /courses/c2 bị chặn bởi paywall PREMIUM và thời lượng bài học không xuống dòng', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'student-free');
    await page.getByRole('link', { name: 'Khoá học', exact: true }).click();
    await expect(page).toHaveURL(/\/courses$/);

    // Mở khoá học c2
    await page
      .locator('a[href="/courses/c2"]', { hasText: 'Xem đề cương' })
      .getByRole('button', { name: 'Xem đề cương' })
      .click();
    await expect(page).toHaveURL(/\/courses\/c2$/);

    // Kiểm tra thời lượng bài học nằm trên 1 dòng (không bị gãy "40\nphút")
    const durationEl = page.locator('#course-syllabus li span', { hasText: /^\d+ phút$/ }).first();
    await expect(durationEl).toBeVisible();
    const box = await durationEl.boundingBox();
    expect(box?.height ?? 999).toBeLessThan(30);

    // Bấm "Tạo lộ trình ngay" -> hiện paywall PREMIUM
    await page.getByRole('button', { name: /Tạo lộ trình/i }).first().click();
    await expect(
      page.getByText(/Tính năng Lộ trình học tập thích ứng AI dành riêng cho học viên gói/i)
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Nâng cấp gói PREMIUM ngay' })
    ).toHaveAttribute('href', '/pricing');

    tracker.assertClean();
  });

  test('TC9: Tài khoản PREMIUM tạo mới lộ trình, trượt chặng -> AI Remediation -> bấm "Học lại bài này" cuộn & tô nổi bài học -> thi lại đạt 100%', async ({
    page,
  }) => {
    const tracker = trackRuntimeErrors(page);

    await page.goto('/');
    await switchDemoRole(page, 'student-premium');
    await page.getByRole('link', { name: 'Khoá học', exact: true }).click();
    await page
      .locator('a[href="/courses/c1"]', { hasText: 'Xem đề cương' })
      .getByRole('button', { name: 'Xem đề cương' })
      .click();
    await expect(page).toHaveURL(/\/courses\/c1$/);

    // 1. Mở modal tạo/tạo lại lộ trình AI & kiểm tra form 2 cột
    await page.getByRole('button', { name: /Tạo( lại)? lộ trình AI/i }).click();
    await expect(page.getByText('Tạo Lộ trình Học tập Cá nhân hoá với AI')).toBeVisible();
    await expect(page.getByText('Trình độ hiện tại')).toBeVisible();
    await expect(page.getByText('Thời lượng học (giờ / tuần)')).toBeVisible();

    const goalTextarea = page.locator('textarea[name="targetGoal"]');
    await goalTextarea.fill(
      'Thực hành fullstack React, Express 5, PostgreSQL và vượt qua tất cả bài kiểm tra chặng'
    );
    await page.locator('select[name="currentLevel"]').selectOption('NANG_CAO');
    await page.locator('input[name="hoursPerWeek"]').fill('10');

    const genPathPromise = page.waitForResponse(
      (r) => r.url().includes('/courses/c1/generate-path') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Bắt đầu tạo lộ trình' }).click();
    expect((await genPathPromise).status()).toBe(201);

    await expect(page.getByText('Lộ Trình Thích Ứng AI')).toBeVisible();
    await expect(page.getByText('0%')).toBeVisible();

    // 2. Làm bài kiểm tra chặng 1 với toàn bộ đáp án sai -> kích hoạt AI Remediation
    await page.getByRole('button', { name: /Làm bài kiểm tra xét duyệt chặng/i }).click();
    const quizModal = page.getByRole('dialog');
    await expect(quizModal).toBeVisible();

    // Chọn đáp án D (sai với bộ fallback 0, 1, 1) cho cả 3 câu
    for (let q = 0; q < 3; q++) {
      await quizModal.locator('button', { hasText: /^D/ }).first().click();
      if (q < 2) {
        await quizModal.getByRole('button', { name: 'Câu tiếp theo' }).click();
      }
    }

    const evalFailPromise = page.waitForResponse(
      (r) => r.url().includes('/milestones/') && r.url().endsWith('/evaluate')
    );
    await quizModal.getByRole('button', { name: 'Nộp bài xét duyệt' }).click();
    expect((await evalFailPromise).status()).toBe(200);

    // 3. Kiểm tra thẻ AI Remediation & nút "Học lại bài này"
    await expect(page.getByText('Gói Bổ Trợ Thích Ứng (AI Remediation)')).toBeVisible();
    await page.getByRole('button', { name: 'Học lại bài này' }).first().click();

    await expect(page.getByText(/Đang mở lại bài học cần ôn tập:/i)).toBeVisible();
    await expect(page.locator('#course-syllabus').getByText('Cần ôn lại')).toBeVisible();

    // Kiểm tra tab Câu hỏi ôn tập phát sinh
    await page.getByRole('button', { name: /Câu hỏi ôn tập phát sinh/i }).click();
    await expect(page.getByText(/Câu hỏi bổ trợ 1:/i)).toBeVisible();

    // 4. Xác nhận hoàn thành ôn tập bổ trợ để mở thi lại
    const completeRemPromise = page.waitForResponse(
      (r) => r.url().includes('/remediations/') && r.url().endsWith('/complete')
    );
    await page.getByRole('button', { name: 'Đã hoàn thành ôn tập & Thi lại chặng' }).click();
    expect((await completeRemPromise).status()).toBe(200);

    // 5. Thi lại đạt chặng 1 và chặng 2 -> đạt tiến độ 100%
    const correctOptionPrefixes = [/^A/, /^B/, /^B/];
    for (let milestoneIdx = 0; milestoneIdx < 2; milestoneIdx++) {
      await page.getByRole('button', { name: /Làm bài kiểm tra xét duyệt chặng/i }).click();
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      for (let q = 0; q < 3; q++) {
        await modal.locator('button', { hasText: correctOptionPrefixes[q] }).first().click();
        if (q < 2) {
          await modal.getByRole('button', { name: 'Câu tiếp theo' }).click();
        }
      }

      const evalPassPromise = page.waitForResponse(
        (r) => r.url().includes('/milestones/') && r.url().endsWith('/evaluate')
      );
      await modal.getByRole('button', { name: 'Nộp bài xét duyệt' }).click();
      expect((await evalPassPromise).status()).toBe(200);
    }

    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('Bạn đã vượt qua chặng này thành công')).toHaveCount(2);

    tracker.assertClean();
  });
});
