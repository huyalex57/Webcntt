# DevStudy Hub — Nền tảng Học · Luyện · Thi cho Sinh viên CNTT

[![CI Pipeline](https://github.com/huyalex57/Webcntt/actions/workflows/ci.yml/badge.svg)](https://github.com/huyalex57/Webcntt/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/Node.js-22%20LTS-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**DevStudy Hub** là nền tảng trực tuyến toàn diện hỗ trợ sinh viên Công nghệ Thông tin theo chu trình khép kín: **Học tài liệu chuẩn hoá – Luyện tập AI cá nhân hoá – Thực thi Code Sandbox – Thi lập trình trực tuyến**. 

Dự án được xây dựng theo kiến trúc **Monorepo hiện đại**, kết nối giữa ứng dụng Web React (Vite) và REST API Express 5, cơ sở dữ liệu PostgreSQL (Prisma ORM), bộ nhớ đệm Redis, lưu trữ S3, thực thi code an toàn với Judge0 và trí tuệ nhân tạo thích ứng với mô hình **Gemini 4 Hydrogen Medium**.

---

## 🏗️ Kiến trúc & Công nghệ (Tech Stack)

| Thành phần | Công nghệ chính | Chi tiết triển khai |
|---|---|---|
| **Monorepo** | npm workspaces | Quản lý đa gói: `apps/*`, `packages/*` |
| **Backend API** | Express 5 + TypeScript | RESTful API, Controller-Service pattern, Argon2, Pino Logger, Helmet |
| **Frontend Web** | React 18 + Vite 5 + TypeScript | Single Page App, Tailwind CSS v4, TanStack Query v5, React Hook Form |
| **Code Editor** | Monaco Editor | Trình biên tập code chuẩn VS Code, phím tắt `Ctrl+Enter`, highlight syntax |
| **Database & ORM** | PostgreSQL 16 + Prisma v6 | Quan hệ chuẩn hoá, PostgreSQL Full-Text Search (GIN index), Transaction |
| **Cache & Quota** | Redis 7 (`ioredis`) | Cache tài liệu thịnh hành, phân tán rate-limiting, đếm quota chạy code & AI |
| **Object Storage** | S3-compatible (MinIO / Zenko) | Upload 2 bước trực tiếp bằng AWS SDK Presigned URL, SHA-256 hash chống trùng |
| **Code Sandbox** | Judge0 (Docker) | Môi trường sandbox cô lập không mạng (`no-net`), giới hạn CPU/RAM theo gói tài khoản |
| **AI LLM** | Gemini 4 Hydrogen Medium | Sinh lộ trình thích ứng, phân tích điểm yếu sinh viên, bộ câu hỏi ôn tập tự động |
| **Shared Package** | `@devstudy/shared` | Zod schemas, validation logic và TypeScript types dùng chung đồng bộ |
| **CI / CD** | GitHub Actions | Kiểm thử tự động trên Node 22 với Docker containers PostgreSQL và Redis |

---

## 📁 Cấu trúc Monorepo

```
Webcntt/
├── .github/
│   └── workflows/ci.yml          # CI Pipeline (Build, Prisma Migrate, Seed, Test)
├── apps/
│   ├── api/                      # Backend RESTful API (Express 5 + Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Lược đồ CSDL: User, Resource, Code, Course, AI...
│   │   │   ├── migrations/       # Lịch sử Database Migrations
│   │   │   └── seed.ts           # Dữ liệu mẫu chuẩn hoá cho toàn bộ hệ thống
│   │   ├── src/
│   │   │   ├── config/           # env (Zod), prisma, redis, logger, s3
│   │   │   ├── middlewares/      # requireAuth, requireRole, requirePlan, checkQuota
│   │   │   ├── modules/          # auth, resources, code, courses, learning-path (AI)
│   │   │   ├── scripts/          # test-gemini.ts (Demo CLI cho dịch vụ AI)
│   │   │   └── __tests__/        # 38 Integration & Unit test suites
│   │   └── package.json
│   └── web/                      # Frontend Application (React + Vite + Tailwind)
│       ├── src/
│       │   ├── app/              # Router, Provider, QueryClient
│       │   ├── components/       # UI Primitives: Button, Card, Badge, Modal, Input...
│       │   ├── features/         # auth, resources, playground, courses, learning-path
│       │   ├── lib/              # apiClient (Axios/Ky wrapper), gating, utils
│       │   └── pages/            # 14 trang ứng dụng theo chuẩn workflow
│       └── package.json
├── packages/
│   └── shared/                   # Gói chia sẻ types & Zod schemas dùng chung
│       └── src/
│           ├── constants.ts      # Hạn mức Quota, giới hạn file, ngôn ngữ hỗ trợ
│           └── schemas/          # auth, resource, code, learning-path, course
├── docker-compose.yml            # Docker services: PostgreSQL, Redis, S3, Judge0
└── package.json                  # Root npm workspace configuration
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu tiên quyết
- **Node.js**: Phiên bản 22.x LTS trở lên
- **Docker & Docker Compose**: Để chạy CSDL PostgreSQL, Redis và S3 Storage

### 1. Cài đặt Dependencies
Tại thư mục gốc dự án:
```bash
npm install
```

### 2. Khởi động Infrastructure Containers
Khởi chạy PostgreSQL (5432), Redis (6379) và S3 Server (9000):
```bash
docker compose up -d
```

### 3. Cấu hình Biến môi trường
Tạo file `.env` cho Backend API từ mẫu:
```bash
cp apps/api/.env.example apps/api/.env
```
*(Các tham số mặc định trong `.env.example` đã được đồng bộ sẵn với `docker-compose.yml`)*.

Nếu muốn gọi trực tiếp đến API Google Gemini Cloud thay vì dùng Fallback Engine nội bộ, hãy bổ sung:
```env
GEMINI_API_KEY=AIzaSy...
```

### 4. Triển khai CSDL & Seed Dữ liệu
```bash
# Đồng bộ Prisma Schema vào PostgreSQL
npx --workspace=@devstudy/api prisma migrate deploy

# Nạp dữ liệu seed chuẩn (Tài khoản mẫu, khoá học, đề cương, ngân hàng câu hỏi)
npm run prisma:seed --workspace=@devstudy/api
```

### 5. Khởi chạy Ứng dụng ở môi trường Phát triển (Development)
Chạy đồng thời Backend API và Frontend Web:
```bash
# Terminal 1: Chạy Backend API (Port 4000)
npm run dev:api

# Terminal 2: Chạy Frontend Web (Port 5173)
npm run dev
```
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- Health check: [http://localhost:4000/health](http://localhost:4000/health)

---

## 🎯 Các Phân hệ Tính năng đã Triển khai

### 1. Phân hệ Xác thực & Phân quyền Độc lập (Phase 0)
- **Chu kỳ JWT an toàn kép**: Access Token (15 phút) lưu in-memory phía client; Refresh Token (30 ngày) lưu trong cookie `httpOnly` bảo vệ khỏi XSS.
- **Refresh Token Rotation**: Tự động xoay vòng Refresh Token sau mỗi lần cấp mới, phát hiện và thu hồi toàn bộ phiên đăng nhập nếu token cũ bị sử dụng lại (Token Reuse Detection).
- **Chuỗi Middleware phân quyền chuẩn**:
  $$\text{Client Request} \longrightarrow \text{requireAuth} \longrightarrow \text{requireRole} \longrightarrow \text{requirePlan} \longrightarrow \text{checkQuota}$$
- Đảm bảo Backend là chốt chặn bảo mật duy nhất; giao diện người dùng chỉ phản ánh UX.

### 2. Kho Tài liệu Học tập & Kiểm duyệt S3 (Phase 1 - Closes #34, #35)
- **Tài liệu chuẩn hoá**: Tìm kiếm toàn văn (PostgreSQL Full-Text Search GIN index), bộ lọc đa tiêu chí (môn học, chủ đề, định dạng, độ khó) và phân trang con trỏ (Cursor Pagination).
- **Upload 2 bước với Presigned URL**: Trình duyệt upload trực tiếp file (PDF, DOCX, ZIP $\le$ 50MB) lên S3, không làm nghẽn server API.
- **Chống trùng lặp**: Tự động tính mã băm SHA-256 client/server để từ chối file trùng lặp (HTTP 409 `DUPLICATE_RESOURCE`).
- **Quy trình Kiểm duyệt Moderator**: Hàng đợi tài liệu `PENDING`, hỗ trợ phê duyệt hoặc từ chối kèm lý do và ghi nhận `AuditLog`.

### 3. Code Playground & Thực thi An toàn với Judge0 (Phase 1 - Closes #36, #37)
- **Trình soạn thảo Monaco Editor**: Tích hợp phím tắt chạy nhanh `Ctrl+Enter`, đổi chủ đề, highlight cú pháp 5 ngôn ngữ: **C, C++, Python, Java, Go**.
- **Sandbox cô lập Judge0**: Chạy code cách ly không truy cập mạng (`ENABLE_NETWORK=false`), giới hạn thời gian CPU và bộ nhớ RAM.
- **Hạn mức tài nguyên phân cấp theo Gói (Rate Limit & Quota)**:
  - Tài khoản **FREE**: 30 lượt chạy/ngày, tối đa 2s CPU, 128MB RAM, lưu tối đa 3 snippets.
  - Tài khoản **PREMIUM**: 200 lượt chạy/ngày, tối đa 5s CPU, 512MB RAM, lưu tối đa 50 snippets.
- **Chia sẻ mã nguồn**: Lưu trữ và tạo liên kết công khai cho đoạn mã (`?snippet=<id>`).

### 4. Lộ trình Học tập Thích ứng với AI Gemini 4 Hydrogen Medium (Phase 2 - Closes #40, #41, #42, #43)
- **Sinh lộ trình thích ứng (`POST /api/v1/courses/:id/generate-path`)**:
  - Dựa trên đề cương bài học, mục tiêu sinh viên và hồ sơ năng lực (`SkillProfile`), mô hình **Gemini 4 Hydrogen Medium** phân chia khoá học thành 2–4 Cột mốc (`Milestones`) tuần tự.
  - Mỗi cột mốc đi kèm bộ 3 câu hỏi trắc nghiệm kiểm định chuẩn đầu ra (gồm mã code, 4 phương án, đáp án đúng và lời giải chi tiết).
- **Đánh giá năng lực chặng & Khắc phục điểm yếu thích ứng (`POST /api/v1/milestones/:id/evaluate`)**:
  - Điểm kiểm tra $\ge 70\%$: Chặng chuyển thành `COMPLETED`, mở khoá chặng kế tiếp (`IN_PROGRESS`).
  - Điểm kiểm tra $< 70\%$: Chặng chuyển thành `NEEDS_REVIEW`. Gemini AI tự động phân tích câu hỏi làm sai, đưa ra nhận xét điểm yếu (`weaknessAnalysis`), chỉ định bài học cần xem lại (`recommendedLessons`) và sinh thêm 2 câu hỏi ôn tập phát sinh (`remedialQuestions`).
- **Dynamic Fallback Engine**: Tự động chuyển đổi mượt mà giữa gọi Gemini Cloud API và bộ sinh cục bộ dự phòng (Deterministic Builder), giúp hệ thống không bao giờ bị dừng hoạt động khi offline hoặc mất kết nối API key.
- **Giám sát lượng tiêu thụ Token**: Bảng `AiUsage` ghi nhận thời gian phản hồi (`latencyMs`), `promptTokens` và `completionTokens` của từng yêu cầu.

---

## 👥 Danh sách Tài khoản Kiểm thử (Demo Accounts)

Hệ thống đã được nạp sẵn dữ liệu seed với các tài khoản tương ứng từng vai trò:

| Vai trò | Gói dịch vụ | Email đăng nhập | Mật khẩu mẫu | Quyền hạn nổi bật |
|---|:---:|---|:---:|---|
| **STUDENT** | Free | `huy.nd@edu.vn` | `password123` | Xem tài liệu, chạy code 30 lần/ngày; **không** tạo được lộ trình AI (yêu cầu Premium) |
| **STUDENT** | Premium | `linh.tt@edu.vn` | `password123` | Toàn quyền tạo lộ trình AI Gemini, làm trắc nghiệm chặng, chạy code 200 lần/ngày |
| **LECTURER** | Free | `tuan.tm@hust.edu.vn` | `password123` | Quản lý khoá học, xem tài liệu; bị giới hạn tạo kỳ thi lập trình |
| **LECTURER** | Premium | `bao.tq@hust.edu.vn` | `password123` | Tạo bài thi lập trình trực tuyến, quản lý bài test và chấm điểm |
| **MODERATOR** | Staff | `mod@devstudy.edu.vn` | `password123` | Hàng đợi duyệt tài liệu cộng đồng (`PENDING`), từ chối kèm lý do, xử lý báo cáo |
| **ADMIN** | System | `admin@devstudy.edu.vn` | `password123` | Quản trị người dùng, phân quyền Role/Plan, xem nhật ký kiểm toán `AuditLog` |

---

## 🧪 Kiểm thử Tự động & Chất lượng Mã nguồn

Dự án duy trì tỷ lệ kiểm thử tích hợp và tự động hoá 100% trên toàn bộ monorepo:

```bash
# 1. Chạy toàn bộ 54 bài kiểm thử Monorepo (Web + API)
npm run test

# 2. Chạy riêng bộ kiểm thử tích hợp Backend (38 bài test)
npm run test --workspace=@devstudy/api

# 3. Chạy kiểm thử dịch vụ AI Gemini (10 bài test)
npx --workspace=@devstudy/api vitest run src/__tests__/gemini-service.test.ts

# 4. Chạy script mô phỏng trực quan dòng dữ liệu AI Gemini CLI
npm run test:gemini --workspace=@devstudy/api

# 5. Type-check và Build toàn bộ mã nguồn
npm run build
```

---

## 🗺️ Lộ trình Phát triển Tiếp theo (Roadmap)
- [x] **Phase 0**: Khởi tạo Core Backend API, Database Prisma, JWT Token Rotation, Middleware RBAC.
- [x] **Phase 1**: Kho tài liệu S3 presigned upload, Code Playground Monaco Editor & Judge0 Sandbox.
- [x] **Phase 2 (Sprint AI)**: Tích hợp mô hình Gemini 4 Hydrogen Medium sinh lộ trình học tập thích ứng & bài học bổ trợ điểm yếu.
- [ ] **Phase 3 (Kỳ thi lập trình & Giảng viên)**: Mở rộng phân hệ Giảng viên, tạo đề thi tự động, phòng thi lập trình trực tuyến với chấm bài tự động theo thời gian thực (Server-authoritative timer).
- [ ] **Phase 4 (Thanh toán & Cổng MoMo)**: Tích hợp Webhook cổng thanh toán MoMo nâng cấp tài khoản Premium tự động và mua khoá học chuyên sâu.
