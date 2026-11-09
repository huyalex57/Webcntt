# DevStudy Hub — Học · Luyện · Thi cho sinh viên CNTT

Nền tảng web hỗ trợ sinh viên CNTT: **học tài liệu – luyện AI – chạy code sandbox – thi lập trình**,
hiện thực frontend theo tài liệu workflow (`workflow_web_ho_tro_sinh_vien_cntt_revised.md_3.md`),
business flow theo role và DESIGN.md trong thư mục Stitch gốc.

> **Bản demo frontend + mock API.** Mọi dữ liệu, đăng nhập, thanh toán, chạy code, chấm thi
> đều là mô phỏng phía client. Gating ở FE chỉ là UX — **backend thật phải kiểm tra lại**
> role / plan / quota / Enrollment bằng middleware (`requireAuth → requireRole → requirePlan →
> requireEnrollment → checkQuota`, workflow §4).

## Stack

| Hạng mục | Công nghệ |
|---|---|
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |
| Frontend | React 18 + Vite 5 + TypeScript (strict) |
| Routing | React Router 6 |
| CSS | Tailwind CSS v4 (`@tailwindcss/vite`, `@theme` theo DESIGN.md) |
| Fetch/cache | TanStack Query 5 |
| Form | React Hook Form 7 + Zod (`@hookform/resolvers`) |
| Validation/types dùng chung | `packages/shared` (Zod schemas + types, workflow §5.1/§6) |

Design tokens (DESIGN.md): primary `#1E3A8A` (hover `#172554`), secondary `#0284C7`,
tertiary `#0D9488`, nền `#F8FAFC`, chữ `#0F172A`, border `#E2E8F0`/`#CBD5E1`,
card trắng radius 8px, nút radius 4px, font Inter, status AC `#059669` / WA `#DC2626` /
TLE `#D97706` / CE `#6B7280`. Không dùng gradient trang trí.

## Cách chạy

```bash
cd devstudy-hub
npm install            # cài workspaces (root + apps/web + packages/shared)
npm run dev            # chạy Vite dev server tại http://localhost:5173
npm run build          # build production (tsc + vite build) trong apps/web
```

## Mapping màn hình Stitch → route

| Màn hình Stitch | Route |
|---|---|
| Guest portal / trang chủ (1) & (9) | `/` |
| Modal đăng nhập / đăng ký (2) | `/login`, `/register` |
| Kho tài liệu (3) | `/resources`, `/resources/:id` |
| Dashboard tổng quan (4) | `/dashboard` (cần đăng nhập) |
| Danh sách khoá học (5) | `/courses`, `/courses/:id` |
| Khóa học của tôi (6) | `/my-courses` (cần đăng nhập) |
| Luyện tập AI theo plan (7) | `/practice` (cần đăng nhập) |
| Code playground Judge0 (8) | `/playground` (cần đăng nhập) |
| Thi lập trình | `/exams`, `/exams/:id`, `/exams/new` (LECTURER + Premium) |
| Nâng cấp Premium | `/pricing` |
| Quản trị / kiểm duyệt | `/admin` (MODERATOR / ADMIN) |

Route cần đăng nhập chuyển về `/login` và ghi chú `redirect` trong `location.state`
để quay lại đúng trang sau khi đăng nhập.

## Tài khoản demo

Không cần mật khẩu thật — bấm nút đăng nhập nhanh trên trang `/login`, hoặc dùng
dropdown **“Demo: đổi vai trò”** ở header để chuyển tức thì giữa:

| Demo | Email | Quyền |
|---|---|---|
| Guest | — | Chỉ xem nội dung công khai |
| STUDENT · Free | `huy.nd@edu.vn` | Học, tải tài liệu, AI 10 câu/ngày, playground Free |
| STUDENT · Premium | `linh.tt@edu.vn` | AI không giới hạn, playground cao hơn; **không** tạo được khoá học/bài thi |
| LECTURER · Free | `tuan.tm@hust.edu.vn` | Tạo tài liệu/khoá học; **không** tạo được bài thi |
| LECTURER · Premium | `bao.tq@hust.edu.vn` | Tạo được bài thi lập trình |
| MODERATOR | `mod@devstudy.edu.vn` | Duyệt tài liệu, xử lý báo cáo |
| ADMIN | `admin@devstudy.edu.vn` | Quản trị role/gói/thanh toán (UI mock) |

Mật khẩu demo bất kỳ (≥ 6 ký tự). Access token **chỉ lưu in-memory** (workflow §5.1),
không lưu localStorage; phiên đăng nhập (user demo) được lưu localStorage để tiện demo lại.

## Tính năng đã làm

- **Auth**: AuthContext, login/register (React Hook Form + Zod), logout, refresh mô phỏng,
  demo role switcher, seed user từng vai trò.
- **Gating** (`src/lib/gating.ts` + `RequireAuth`): đúng ma trận workflow §4 và business
  flow §2 — Guest chỉ xem public; tải/luyện/chạy/thi yêu cầu đăng nhập; STUDENT Premium
  không tạo được khoá học/bài thi; LECTURER Free bị chặn tạo bài thi (hiện upsell Premium).
- **Tài liệu**: tìm kiếm + lọc (môn/chủ đề/loại/nguồn), chi tiết, tải (guest → `/login`),
  lưu bộ sưu tập (localStorage), báo cáo vi phạm (form + toast), trạng thái
  PENDING/PUBLISHED/REJECTED. Seed: 14 tài liệu.
- **Khoá học**: danh sách + lọc/sắp xếp, chi tiết (đề cương, học thử 3 bài đầu),
  mua (Order PENDING → mô phỏng thanh toán → Enrollment), “Khoá học của tôi” với
  tiến độ + chứng nhận khi 100%. Seed: 9 khoá học.
- **AI Practice**: form (chủ đề, trình độ, số câu, dạng câu hỏi) → sinh bộ câu hỏi từ
  ngân hàng mẫu → làm bài → chấm điểm + giải thích → cập nhật SkillProfile (thanh điểm
  yếu theo chủ đề). Quota Free 10 câu/ngày đếm bằng localStorage, hết quota → chặn +
  upsell (mô phỏng 429). Seed: 24 câu hỏi (CTDL/OOP/CSDL/Mạng/HĐH/AI/Web).
- **Playground**: editor textarea có hỗ trợ Tab (Ctrl+Enter để chạy) + line numbers,
  chọn ngôn ngữ C/C++/Python/Java/Go, stdin, Run → mock Judge0 trả stdout/stderr/
  exit code/time/memory + status chip AC/WA/TLE/CE, lưu snippet (giới hạn theo plan:
  Free 3, Premium 50; chạy/ngày Free 30, Premium 200).
- **Thi**: danh sách kỳ thi, trang làm bài (đồng hồ đếm ngược, autosave mô phỏng 15s,
  nộp bài → kết quả từng test), trang tạo kỳ thi cho LECTURER Premium (form + thêm
  problem). Seed: 3 kỳ thi.
- **Admin/Mod**: hàng đợi duyệt PENDING (duyệt/từ chối), xử lý báo cáo vi phạm, bảng
  quản trị user (ADMIN) — UI mock với dữ liệu seed.
- **UI dùng chung**: Button, Card, Badge, Modal, Input/Select/Textarea, Header + Sidebar,
  Pagination, EmptyState, QuotaBar, Toast. Responsive mobile → desktop, tiếng Việt toàn bộ.

## Những gì là mock / placeholder

| Mục | Trạng thái hiện tại | Bước tiếp theo (backend thật) |
|---|---|---|
| API | `src/lib/api.ts` mô phỏng REST `/api/v1` (delay 300–600ms, seed trong `src/lib/seed.ts`) | Express 5 + Prisma/PostgreSQL theo workflow §7; thay body các hàm `api.ts` bằng `fetch()` |
| Auth | Mock login, token in-memory, không có refresh-token rotation thật | JWT access (15 phút) + refresh httpOnly cookie + rotation (workflow §5.1) |
| AI Practice | Sinh câu hỏi từ ngân hàng 24 câu mẫu, không gọi LLM | AI service (Claude/OpenAI) trả JSON theo schema → validate Zod, cache, quota Redis (workflow §5.4) |
| Playground | **Textarea + line numbers là placeholder cho Monaco Editor**; `runCode` là mock Judge0 bằng heuristic | Tích hợp Monaco Editor + gọi Judge0 self-host qua BullMQ worker, sandbox cô lập (workflow §5.5) |
| Thanh toán | Mock checkout kích hoạt Premium/Enrollment ngay | VNPay/MoMo/Stripe; **chỉ webhook hợp lệ mới cấp quyền** (workflow §5.3, business flow §8) |
| Thi | Chấm mock đồng bộ, đồng hồ đếm ngược phía client | Server là nguồn thời gian chuẩn; chấm qua queue, autosave thật, chống gian lận (workflow §5.6) |
| Upload/video | Chưa có | S3-compatible + presigned URL (workflow §2.2) |
| Email | Chưa có | Nodemailer/Resend: xác thực email, quên mật khẩu |

## Cấu trúc thư mục

```
devstudy-hub/
├─ package.json                 # npm workspaces: apps/*, packages/*
├─ README.md
├─ packages/shared/src/index.ts # types + Zod schemas (User, Role, PlanTier, Resource, Course, Question, Exam…)
└─ apps/web/
   ├─ package.json  vite.config.ts  tsconfig.json  index.html
   └─ src/
      ├─ main.tsx  index.css       # Tailwind v4 + @theme (DESIGN.md)
      ├─ app/                     # router.tsx, providers.tsx (QueryClient, Auth)
      ├─ features/                # auth, resources, courses, ai-practice, playground, exams, subscription
      ├─ components/              # ui.tsx (Button/Card/Badge/Modal/Input…), Layout.tsx (Header/Sidebar)
      ├─ lib/                     # api.ts (mock REST), seed.ts, gating.ts, utils.ts, toast.tsx
      └─ pages/                   # Home, Login, Register, Dashboard, Resources(+Detail),
                                  # Courses(+Detail), MyCourses, Practice, Playground,
                                  # Exams(+Detail, +Create), Pricing, Admin
```
