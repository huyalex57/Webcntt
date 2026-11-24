# Runbook Vận hành & Triển khai — Module `@devstudy/ai-review`

Tài liệu vận hành cho module plug-and-play **AI Ôn tập & Lộ trình** (`@devstudy/ai-review`) tích hợp trong hệ thống DevStudy Hub.

---

## 1. Kiến trúc & Nguyên tắc Plug-and-Play

- **Tách biệt mã nguồn**: toàn bộ nghiệp vụ module nằm trong `packages/ai-review/`; điểm nối với core nằm gọn trong `apps/api/src/integrations/ai-review/` và 1 khối dynamic import có điều kiện trong `apps/api/src/index.ts`.
- **Tách biệt CSDL**: module sử dụng Postgres schema riêng `ai_review` (không có khoá ngoại FK sang bảng `public` của core), migration riêng và Prisma client riêng.
- **Đối tượng sử dụng**: chỉ `STUDENT` (`LECTURER`, `MODERATOR`, `ADMIN` nhận `403 FORBIDDEN_ROLE` trên `/api/v1/ai-review/*`).
- **Tối giản PII**: tuyệt đối không gửi `email`, `displayName`, `studentId` hay đáp án (`correctIndex`, `explanation`) sang nhà cung cấp LLM; mọi log đi qua bộ redact Pino (`AI_REVIEW_REDACT_PATHS`).
- **Frontend**: gộp trực tiếp vào trang `/practice`, tự thăm dò `GET /api/v1/ai-review/status`; khi module tắt (`404`) hoặc người dùng không phải `STUDENT`, giao diện AI Review tự ẩn mượt và core vẫn hoạt động bình thường.

---

## 2. Biến môi trường & Đổi Model không sửa code

Xem mẫu chuẩn trong `packages/ai-review/.env.example`:

| Biến | Bắt buộc khi bật | Mô tả |
|---|---|---|
| `AI_REVIEW_ENABLED` | Có (`true`/`false`) | Feature flag bật/tắt module (mặc định `false` — route trả `404`, không nạp package). |
| `AI_REVIEW_DATABASE_URL` | Có | Chuỗi kết nối Postgres **bắt buộc có `?schema=ai_review`** (khuyến nghị `&connection_limit=5`). |
| `AI_REVIEW_LLM_PROVIDER` | Có | `gemini` hoặc `fake` (dùng `fake` cho dev/CI offline). |
| `AI_REVIEW_LLM_MODEL` | Có | ID model truyền qua env, ví dụ `gemini-4-medium` hoặc `gemini-3.8-flash` (**không hard-code**). |
| `AI_REVIEW_LLM_API_KEY` | Khi `gemini` | Khoá API Gemini, chỉ gửi qua header `x-goog-api-key` (không gắn vào URL). |
| `AI_REVIEW_LLM_BASE_URL` | Không | Mặc định `https://generativelanguage.googleapis.com/v1beta`. |
| `AI_REVIEW_LLM_TIMEOUT_MS` | Không | Mặc định `20000` (ms). |
| `AI_REVIEW_LLM_MAX_OUTPUT_TOKENS` | Không | Mặc định `1024`. |
| `AI_REVIEW_LLM_MAX_RETRIES` | Không | Mặc định `1` (chỉ retry lỗi tạm thời `429`/`5xx`/network/timeout). |
| `AI_REVIEW_TIMEZONE` | Không | Mặc định `Asia/Ho_Chi_Minh` (reset quota ngày lúc 00:00 giờ VN). |
| `AI_REVIEW_QUOTA_FAIL_MODE` | Không | Mặc định `closed` (trả `503` khi kho quota lỗi để tránh đội chi phí LLM); có thể chuyển `open` nếu muốn degraded-allow. |
| `AI_REVIEW_TOKEN_SECRET` | Khuyến nghị | Chuỗi ≥ 32 ký tự **khác** `JWT_SECRET` của core để ký AI token ngắn hạn. |

### Đổi model LLM (ví dụ `gemini-4-medium` → `gemini-3.8-flash`)
1. Cập nhật biến môi trường `AI_REVIEW_LLM_MODEL=gemini-3.8-flash`.
2. Khởi động lại dịch vụ API (`rolling restart`).
3. Kiểm tra `GET /api/v1/ai-review/health` và kiểm tra cột `model_id` trong `ai_review.usage_events`. Không cần build lại hay sửa mã nguồn.

---

## 3. Quy trình Triển khai (Phased Rollout)

### Giai đoạn 0 — Chuẩn bị CSDL & Dữ liệu
```bash
# 1. Áp dụng migration core (Phase 0 - chỉ thêm mới, có down.sql)
npx --workspace=@devstudy/api prisma migrate deploy

# 2. Áp dụng migration schema riêng ai_review
AI_REVIEW_DATABASE_URL="postgresql://.../itlearn?schema=ai_review&connection_limit=5" \
  npm run migrate:up --workspace=@devstudy/ai-review

# 3. Nạp dữ liệu lộ trình awesome-roadmaps (0PL-1.0, pin commit SHA + verify LICENSE SHA-256)
AI_REVIEW_DATABASE_URL="postgresql://.../itlearn?schema=ai_review&connection_limit=5" \
  npx tsx scripts/roadmap-ingest/ingest.ts
```

### Giai đoạn 1 — Staging với `fake` provider
- Đặt `AI_REVIEW_ENABLED=true`, `AI_REVIEW_LLM_PROVIDER=fake`, `AI_REVIEW_LLM_MODEL=fake-v1`.
- Xác minh `GET /api/v1/ai-review/status` (`200`), `GET /api/v1/ai-review/health` (`200`), luồng `/practice` tạo bộ 20 câu, nộp bài cập nhật `SkillProfile`, kiểm tra `LECTURER` bị `403`.

### Giai đoạn 2 — Staging với `gemini` provider
- Đặt `AI_REVIEW_LLM_PROVIDER=gemini`, `AI_REVIEW_LLM_MODEL=gemini-4-medium` (hoặc `gemini-3.8-flash`), `AI_REVIEW_LLM_API_KEY=<secret>`.
- Chạy smoke test `POST /api/v1/ai-review/summary` và `POST /api/v1/ai-review/exam-sets` (`use_ai: true`).
- Kiểm tra `ai_review.usage_events` có ghi nhận `input_tokens`, `output_tokens`, `latency_ms`, `model_id`; kiểm tra log server không lộ `AIza...` / JWT / email.

### Giai đoạn 3 — Production Rollout
- Theo dõi 24 giờ đầu: tỉ lệ fallback (`source = 'rule_based'`), tỉ lệ `429 QUOTA_EXCEEDED`, tỉ lệ `ai_review.output_guard_rejected`, tổng token/ngày theo plan (`FREE`: 3 bộ đề/ngày & 150.000 token/tháng; `PREMIUM`: 30 bộ đề/ngày & 5.000.000 token/tháng).

---

## 4. Quy trình Tắt khẩn cấp (Kill Switch), Rollback & Gỡ Module

### 4.1 Tắt khẩn cấp (< 30 giây, không mất dữ liệu)
1. Đặt `AI_REVIEW_ENABLED=false`.
2. Restart API server.
3. Xác minh:
   - `GET /api/v1/ai-review/status` trả `404`.
   - `GET /health`, `GET /ready`, `/api/v1/practice/*` hoạt động bình thường; `checkQuota('ai_questions')` tự quay về logic core.
   - Trang `/practice` trên web tự ẩn thẻ AI Review & hiển thị chế độ ngân hàng câu hỏi core.

### 4.2 Rollback từng migration của module
```bash
# Rollback migration gần nhất trong schema ai_review (không ảnh hưởng schema public)
AI_REVIEW_DATABASE_URL="postgresql://.../itlearn?schema=ai_review&connection_limit=5" \
  npm run migrate:down --workspace=@devstudy/ai-review
```

### 4.3 Gỡ bỏ hoàn toàn module khỏi hệ thống
1. Đặt `AI_REVIEW_ENABLED=false` và restart API.
2. Xoá toàn bộ schema `ai_review`:
   ```bash
   AI_REVIEW_DATABASE_URL="postgresql://.../itlearn?schema=ai_review&connection_limit=5" \
     npm run migrate:down:all --workspace=@devstudy/ai-review
   ```
3. Xoá thư mục `packages/ai-review/` và `apps/api/src/integrations/ai-review/` (và test tích hợp riêng nếu cần).
4. Kiểm chứng build & test core không có module:
   ```bash
   npm run verify:core-without-module
   ```

---

## 5. Cập nhật Dữ liệu Lộ trình (`awesome-roadmaps`, 0PL-1.0)

Pipeline ingest chỉ chạy **offline hoặc qua CI** (`.github/workflows/roadmap-ingest.yml`), tuyệt đối không clone lúc runtime:
1. Kiểm tra commit mới trên `https://github.com/liuchong/awesome-roadmaps`, đặc biệt xác minh file `LICENSE` vẫn là Zero Public License (`0PL-1.0`).
2. Cập nhật `commitSha` (và `expectedLicenseSha256` nếu có thay đổi đã được duyệt) trong `scripts/roadmap-ingest/config.json`.
3. Chạy `npx tsx scripts/roadmap-ingest/ingest.ts --parse-only` để xem snapshot mới.
4. Duyệt và bổ sung ánh xạ chủ đề vào `scripts/roadmap-ingest/mapping/reviewed-topic-tag-map.csv` (đảm bảo tỷ lệ phủ duyệt tay ≥ 80%).
5. Chạy `npx tsx scripts/roadmap-ingest/ingest.ts` — các topic bị gỡ ở upstream sẽ được soft-deprecate (`deprecated_at`), giữ ổn định ID hiện có.

---

## 6. Giám sát & Xử lý sự cố

| Tín hiệu cảnh báo | Nguyên nhân khả dĩ | Hành động xử lý |
|---|---|---|
| Tăng đột biến `503 QUOTA_SERVICE_UNAVAILABLE` | Kết nối Postgres schema `ai_review` gián đoạn hoặc hết pool | Kiểm tra Postgres & `connection_limit`; giữ `AI_REVIEW_QUOTA_FAIL_MODE=closed` để chống đội chi phí LLM, hoặc tạm tắt `AI_REVIEW_ENABLED=false`. |
| Tăng đột biến `ai_review.llm_error_fallback` | Gemini API lỗi 5xx/timeout/hết hạn mức key | Hệ thống đã tự fallback rule-based nên học sinh vẫn nhận được bộ 20 câu & tóm tắt; kiểm tra trạng thái API key hoặc đổi nhanh `AI_REVIEW_LLM_MODEL=gemini-3.8-flash`. |
| Tăng đột biến `security.prompt_injection_signal` hoặc `ai_review.output_guard_rejected` | Có hành vi thử nghiệm prompt injection hoặc model xuất link/định dạng lạ | Truy vấn `ai_review.audit_events` theo `action` (không chứa PII), xem `meta.signals` / `meta.reason`, cân nhắc siết `AI_REVIEW_RATE_LIMIT_MAX`. |
| Tăng `429 QUOTA_EXCEEDED` | Người dùng gói `FREE` chạm trần 3 bộ đề/ngày hoặc 150k token/tháng | Kiểm tra bảng `ai_review.plan_limits` nếu cần điều chỉnh hạn mức gói; hệ thống tự gửi `Retry-After` và `X-Quota-Reset` theo giờ VN. |
| Nghi ngờ rò rỉ dữ liệu nhạy cảm trong log | Cấu hình logger mới bỏ sót đường dẫn redact | Chạy kiểm định tự động `npm run test --workspace=@devstudy/ai-review` (bài test Log Hygiene Phase 9) và grep log sink với mẫu `AIza`, `Bearer eyJ`, `@`. |
