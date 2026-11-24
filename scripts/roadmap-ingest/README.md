# Roadmap Ingest Pipeline (`liuchong/awesome-roadmaps`)

Pipeline ingest **offline / CI** cho nguồn roadmap mã nguồn mở (Phương án C):
- Repo: `https://github.com/liuchong/awesome-roadmaps`
- License: **0PL-1.0 (Zero Public License)** — cho phép sử dụng, sửa đổi, phân phối không hạn chế mục đích.
- Commit pin & SHA-256 `LICENSE` khai báo trong [`config.json`](./config.json).
- **Tuyệt đối không chạy lúc runtime**: ứng dụng chỉ đọc bảng `ai_review.roadmap_*` qua `RoadmapService` read-only.

## Cách chạy cục bộ
```bash
# 1. Chỉ parse & xuất snapshot (không ghi DB)
npx tsx scripts/roadmap-ingest/ingest.ts --parse-only

# 2. Ingest đầy đủ (verify commit SHA + verify LICENSE SHA-256 + parse + load vào schema ai_review)
AI_REVIEW_DATABASE_URL="postgresql://app:app@localhost:5432/itlearn?schema=ai_review&connection_limit=5" \
  npx tsx scripts/roadmap-ingest/ingest.ts
```

## Quy trình nâng cấp commit (bump SHA)
1. Kiểm tra diff giữa commit cũ và commit mới trên `liuchong/awesome-roadmaps`, đặc biệt là file `LICENSE`.
2. Cập nhật `commitSha` (và `expectedLicenseSha256` nếu đã duyệt lại license) trong `config.json`.
3. Chạy `ingest.ts --parse-only`, bổ sung mapping mới vào `mapping/reviewed-topic-tag-map.csv` để duyệt tay.
4. Chạy `ingest.ts` — topic cũ bị gỡ khỏi upstream sẽ được đánh dấu `deprecated_at` (không hard-delete).
