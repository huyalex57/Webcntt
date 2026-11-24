# `@devstudy/ai-review` — Plug-and-Play Module

Module độc lập cho tính năng **AI Ôn tập & Lộ trình** trên nền tảng DevStudy Hub.

## Nguyên tắc tách biệt (Plug-and-Play)
- **Feature flag**: mặc định tắt (`AI_REVIEW_ENABLED=false`). Khi tắt, core không dynamic-import package và mọi route `/api/v1/ai-review/*` trả `404`.
- **Giao tiếp qua contract**: chỉ trao đổi với core qua `AiReviewHostPorts` và `EventBusPort` (phiên bản `CONTRACT_VERSION = 1`). Mọi adapter của host nằm gọn trong `apps/api/src/integrations/ai-review/`.
- **Database riêng biệt**: sử dụng Postgres schema `ai_review`, Prisma client riêng và migration riêng — **không có khoá ngoại (FK)** sang bảng core (`public`).
- **Kiểm tra ranh giới import**: chạy `npm run check:boundaries` ở thư mục gốc monorepo.

## Biến môi trường
Xem đầy đủ trong [`.env.example`](./.env.example). Biến bắt buộc khi bật (`AI_REVIEW_ENABLED=true`):
- `AI_REVIEW_DATABASE_URL`: phải chỉ định `?schema=ai_review` (khuyến nghị thêm `&connection_limit=5`).
- `AI_REVIEW_LLM_PROVIDER`: `gemini` hoặc `fake`.
- `AI_REVIEW_LLM_MODEL`: bắt buộc truyền qua env (ví dụ `gemini-4-medium` hoặc `gemini-3.8-flash`), **không** hard-code trong mã nguồn.
- `AI_REVIEW_LLM_API_KEY`: bắt buộc khi `AI_REVIEW_LLM_PROVIDER=gemini`.
- `AI_REVIEW_TIMEZONE`: mặc định `Asia/Ho_Chi_Minh` (reset quota ngày lúc 00:00 giờ Việt Nam).
- `AI_REVIEW_QUOTA_FAIL_MODE`: `closed` (mặc định, trả 503 khi kho quota lỗi) hoặc `open`.

## Quota theo gói (`FREE` / `PREMIUM`)
- Bảng `ai_review.plan_limits`, `ai_review.usage_counters` (đếm atomic 1 câu SQL), `ai_review.usage_events` (append-only cho thống kê/billing).
- `exam_sets`: giới hạn theo ngày giờ VN (`FREE: 3/ngày`, `PREMIUM: 30/ngày`).
- `llm_tokens`: giới hạn theo chu kỳ tháng tính từ `subscriptions.startedAt` (`FREE: 150.000/tháng`, `PREMIUM: 5.000.000/tháng`).
- Endpoint: `GET /api/v1/ai-review/quota` (chỉ `STUDENT`). Khi bật module, quota mới tự động thay thế `checkQuota('ai_questions')` của core.

## Bảo mật, Idempotency & Audit (Phase 3)
- Bảng `ai_review.idempotency_keys` (TTL 24 giờ, bắt buộc header `Idempotency-Key` dạng UUID cho thao tác tạo mới; replay trả `Idempotent-Replayed: true` không trừ quota lần 2; khác body trả `409 IDEMPOTENCY_KEY_CONFLICT`) và `ai_review.audit_events` (lọc bỏ PII/JWT trước khi ghi).
- JSON Schema Draft 2020-12 nghiêm ngặt (`Ajv`, `additionalProperties: false`, không ép kiểu ngầm) cho payload dựng bộ đề (`exam-set-create.v1.json`).
- Chặn ghi đè `student_id`/`userId` qua query hoặc body (`403 FORBIDDEN_STUDENT_OVERRIDE` + audit `DENY`); DTO tối giản PII tại `GET /api/v1/ai-review/me/profile` và `GET /api/v1/ai-review/me/attempts`.
- Rate limit theo `userId` (`X-RateLimit-*`, `429 RATE_LIMIT_EXCEEDED` + `Retry-After`) và helper AI token ngắn hạn có scope (`HS256`, TTL ≤ 5 phút, secret riêng).

## Recommender & Dựng bộ đề 20 câu (Phase 4)
- Thuật toán mastery có trọng số thời gian (half-life 14 ngày), trọng số độ khó, phạt trả lời chậm (> 2× thời gian chuẩn) và Bayesian prior ($\alpha = 2, p_0 = 0.6$).
- Phân bổ chuẩn 20 câu: 60% chủ đề yếu (top ≤ 4, largest-remainder), 25% ôn ngắt quãng (câu từng sai ≥ 3 ngày trước), 15% exploration; loại câu làm trong 7 ngày gần đây (trừ slot ôn sai); xếp hạng tất định không ngẫu nhiên.
- Chống hallucination & fallback: lọc mọi ID đề xuất qua pool `APPROVED`; dưới 50% hợp lệ hoặc khi LLM lỗi sẽ tự động fallback hoàn toàn sang rule-based (`source: llm | hybrid | rule_based`).
- Endpoints (`STUDENT` only): `GET /api/v1/ai-review/recommendations` (0 token LLM), `POST /api/v1/ai-review/exam-sets`, `GET /api/v1/ai-review/exam-sets`, `GET /api/v1/ai-review/exam-sets/:id` (chỉ chủ sở hữu, không lộ đáp án).

## Roadmap Ingest (0PL-1.0) & `RoadmapService` Read-Only (Phase 5)
- Nguồn dữ liệu (Phương án C): `https://github.com/liuchong/awesome-roadmaps` (giấy phép **0PL-1.0 — Zero Public License**), pin chính xác commit SHA và kiểm tra SHA-256 file `LICENSE` trong `scripts/roadmap-ingest/config.json`. **Tuyệt đối không clone lúc runtime**.
- Pipeline offline/CI (`scripts/roadmap-ingest/ingest.ts`) parse `README.md` về bảng `ai_review.roadmap_sources`, `roadmaps`, `roadmap_topics` (cây cha-con với ID ổn định `rm:<roadmap>:<topic>`), `topic_tag_map` (mapping đã duyệt tay từ `mapping/reviewed-topic-tag-map.csv` + gợi ý tự động chưa duyệt); topic bị gỡ ở upstream được đánh dấu `deprecated_at` (không hard-delete).
- `RoadmapService` hoàn toàn read-only (thay thế MCP server đã bỏ): kiểm tra regex chặt trên `slug`/`id` (chặn path traversal), giới hạn output ≤ 16 KB, luôn trả kèm `source_url` & `attribution`.
- Endpoints (`STUDENT` only): `GET /api/v1/ai-review/roadmaps`, `GET /api/v1/ai-review/roadmaps/:slug`, `GET /api/v1/ai-review/roadmap-topics/search?q=...`, `GET /api/v1/ai-review/roadmap-topics/:id`. Truyền `roadmap_topic_ids[]` vào `POST /api/v1/ai-review/exam-sets` sẽ tự phân giải sang `ResourceTopic` đã được duyệt để chọn câu hỏi phù hợp; `GET /api/v1/ai-review/recommendations` trả kèm `recommended_roadmaps`.

## `LLMProvider` & AI Review Enrichment (Phase 7)
- Giao diện `LLMProvider` tách biệt hoàn toàn với nghiệp vụ (`GeminiProvider`, `FakeProvider`, factory `createLlmProvider`): đổi model (`AI_REVIEW_LLM_MODEL`) hoặc đổi nhà cung cấp (`AI_REVIEW_LLM_PROVIDER`) hoàn toàn qua biến môi trường, **không** hard-code model ID.
- `GeminiProvider`: gửi khoá API **duy nhất qua header `x-goog-api-key`** (không bao giờ nằm trên URL hoặc thông báo lỗi), có `AbortController` timeout, retry tối đa 1 lần trên lỗi tạm thời (`429`/`5xx`/network/timeout) và ghi chính xác `input_tokens` / `output_tokens` vào `ai_review.usage_events`.
- Chống Prompt Injection & Output Guardrails:
  - Dữ liệu không tin cậy (mục tiêu sinh viên, thống kê mastery ẩn danh, tiêu đề/tóm tắt roadmap, danh sách câu hỏi ứng viên) luôn bị sanitize và bọc trong `<data label="..." untrusted="true">...</data>` (chặn breakout `</data>`). Tuyệt đối không gửi PII hay đáp án đúng sang LLM.
  - Mọi phản hồi JSON từ LLM đi qua kiểm tra Ajv Draft 2020-12 (`additionalProperties: false`), đối chiếu chính xác `reference_url` & `roadmap_topic_id` với ground-truth từ `RoadmapService`, và quét chống rò rỉ bí mật/JWT/email/đáp án/XSS.
  - Khi LLM lỗi, timeout, trả JSON hỏng hoặc bị Output Guard từ chối, hệ thống ghi `audit_events` và tự động fallback về bộ sinh rule-based tất định.
- Endpoints (`STUDENT` only):
  - `POST /api/v1/ai-review/summary`: phân tích điểm yếu & lộ trình ôn tập tiếng Việt bằng AI (kiểm tra hạn mức `llm_tokens`/tháng — trả `429` nếu hết; fallback tất định khi LLM lỗi).
  - `POST /api/v1/ai-review/exam-sets` (với `use_ai: true`): nhờ LLM xếp hạng & chọn bộ đề 20 câu từ danh sách ứng viên `APPROVED` do backend cung cấp, sau đó đối chiếu lại toàn bộ ID với DB (chống hallucination + ngưỡng 50% hybrid/fallback).

## Migration (Up / Rollback)
```bash
# Áp dụng migration vào schema ai_review
AI_REVIEW_DATABASE_URL="postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=5" \
  npm run migrate:up --workspace=@devstudy/ai-review

# Rollback migration gần nhất trong schema ai_review
AI_REVIEW_DATABASE_URL="postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=5" \
  npm run migrate:down --workspace=@devstudy/ai-review

# Xoá toàn bộ schema ai_review (không ảnh hưởng schema public của core)
AI_REVIEW_DATABASE_URL="postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=5" \
  npm run migrate:down:all --workspace=@devstudy/ai-review
```

## Gỡ bỏ module hoàn toàn
1. Đặt `AI_REVIEW_ENABLED=false` và khởi động lại API.
2. Chạy `npm run migrate:down:all --workspace=@devstudy/ai-review` để xoá schema `ai_review`.
3. Xoá thư mục `packages/ai-review/` và `apps/api/src/integrations/ai-review/`.
4. Core vẫn build và chạy test bình thường (`npm run verify:core-without-module`).

## Tài liệu vận hành (Runbook)
Xem đầy đủ quy trình rollout, đổi model LLM qua env, tắt khẩn cấp, cập nhật commit `awesome-roadmaps` và xử lý sự cố tại [`docs/ai-review-runbook.md`](../../docs/ai-review-runbook.md).
