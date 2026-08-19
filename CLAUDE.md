# CLAUDE.md — T_Hotel

Bối cảnh dự án. Quy tắc hành xử: RULE.md (bắt buộc đọc trước khi hành động).

## Dự án

T_Hotel — hệ thống đặt phòng khách sạn. Là dự án portfolio chủ lực, gộp trọn lộ trình 10 giai đoạn Backend Engineering và DevOps vào một codebase, nhằm tạo điểm nhấn trong CV.

Chọn domain khách sạn vì user đã có dự án đặt vé xem phim. Nghiệp vụ lõi:

- Phòng theo loại (single, double, suite), giá thay đổi theo mùa và theo ngày
- Kiểm tra tồn phòng theo khoảng ngày check-in đến check-out, chống double-booking
- Luồng đặt phòng, xác nhận, thanh toán, gửi email
- Hủy và đổi lịch kèm chính sách hoàn tiền theo thời điểm
- Phân quyền khách hàng và admin

## Developer

Giao tiếp tiếng Việt. Thành thạo lập trình backend, chưa có kinh nghiệm DevOps. Mục tiêu là năng lực đi phỏng vấn, không phải có sẵn code chạy được. Ưu tiên một dự án sâu thay vì nhiều dự án nhỏ.

## Kiến trúc hybrid hai track

Vercel là nền tảng serverless, không chạy được container dài hạn, Kubernetes hay Prometheus tự host, trong khi đó là nội dung cốt lõi của giai đoạn 3, 6, 7, 8, 9. Giải pháp: một codebase, hai đích triển khai.

| | Track A | Track B |
|---|---|---|
| Hạ tầng | Vercel và Supabase | VPS giá rẻ khoảng 5 đến 6 USD mỗi tháng |
| Vai trò | Bản demo live, link đưa vào CV | Thực hành và chứng minh kỹ năng DevOps |
| Phủ giai đoạn | 1, 2, 5 | 3, 4, 6, 7, 8, 9 |

Quyết định này là câu chuyện chính khi phỏng vấn: chọn công cụ theo bài toán.

## Stack

TypeScript, NestJS, Next.js, Supabase (Postgres và Auth), npm workspaces, Redis với BullMQ, Prometheus và Grafana, Docker và k3s, Terraform và Ansible, GitHub Actions với GHCR.

Máy hiện tại có Node v24, npm 11, git. Chưa cài Docker, cần trước giai đoạn 3. Không dùng pnpm.

## Cấu trúc

```
t-hotel/
├── apps/{web, api, notification-service, payment-service}
├── packages/{shared-types, shared-config}
├── infra/{docker, k8s, terraform, ansible, monitoring}
├── .github/workflows/
└── docs/
```

## Lộ trình

| # | Giai đoạn | Deliverable | Gate |
|---|---|---|---|
| 1 | REST API | apps/api: CRUD phòng, kiểm tra tồn theo ngày, booking, Supabase Auth và phân quyền, validation, Jest và Supertest | Test xanh, gọi được endpoint thật |
| 2 | Full-stack | apps/web: đăng nhập, tìm phòng trống, đặt phòng, lịch sử; trang admin quản lý phòng và giá | Chạy trọn luồng trên trình duyệt |
| 3 | Docker | Dockerfile multi-stage mỗi service, docker-compose gồm api, notification, payment, Postgres, Redis | docker compose up, healthcheck pass |
| 4 | CI/CD | GitHub Actions: lint và test mỗi PR, build và push image lên GHCR, deploy cả hai track | PR xanh, image xuất hiện trên GHCR |
| 5 | Cloud | Track A: Vercel, Supabase, custom domain. Track B: VPS, Nginx reverse proxy, HTTPS Let's Encrypt | Hai URL HTTPS truy cập được |
| 6 | Monitoring | Prometheus scrape metrics các service, Grafana dashboard, structured JSON log, alert rules | Metrics thật hiển thị, alert kích hoạt được |
| 7 | Microservices | Tách notification và payment, giao tiếp qua Redis và BullMQ, retry và dead-letter queue | Đặt phòng sinh job async trong log |
| 8 | Kubernetes | k3s, manifest hoặc Helm chart, HPA, rolling update, Kubernetes Secrets | Scale được, update không downtime |
| 9 | IaC | Terraform provision VPS, firewall, DNS. Ansible cài Docker, k3s, Nginx | Xoá VPS rồi dựng lại y hệt bằng hai lệnh |
| 10 | Capstone | docs/architecture.md, README, demo, security checklist | Người ngoài đọc hai phút hiểu kiến trúc |

## Trạng thái

**Giai đoạn 1 — REST API: gate đã pass** (2026-08-19).

Đã có:

- Monorepo npm workspaces: `apps/api` (NestJS), `packages/shared-types`.
- Schema Postgres: `hotels`, `room_types`, `rooms`, `rate_plans`, `profiles`, `bookings`.
  Chống double-booking bằng exclusion constraint GiST trên `daterange` nửa mở `[)`, có
  `WHERE status <> 'cancelled'`. Giá theo mùa tính bằng hàm SQL `calculate_stay_price`.
- Migration runner tự viết (file `.sql` đánh số + bảng `schema_migrations` có checksum).
- API: CRUD phòng và loại phòng, rate plan theo mùa, tìm phòng trống theo khoảng ngày,
  đặt phòng, xem lịch sử, huỷ, health check.
- Supabase Auth: xác minh JWT HS256, guard toàn cục mặc định đóng, role trong `public.profiles`.
- Validation toàn cục (`whitelist` + `forbidNonWhitelisted`), map lỗi Postgres sang HTTP.
- Test: 23 unit + 34 e2e trên Postgres thật (`embedded-postgres`, không cần Docker),
  gồm test đồng thời chứng minh R12. Lint sạch.
- Smoke test HTTP thật: 18/18 pass trên server đang chạy.
- ADR 0001–0006 và `docs/giai-doan-1-khai-niem.md`.

Chưa xong / còn nợ:

- **Schema chưa được áp lên Supabase project thật** (`lgkasgosvvmdmltzpgsk`). Thiếu database
  password — chỉ user lấy được ở Dashboard → Project Settings → Database. Lệnh cần chạy:
  `npm run db:migrate` với `DATABASE_URL` trỏ về Supabase và `DATABASE_SSL=true`.
- Chưa `git init` (R7 không cho tự push; repo khởi tạo khi user đồng ý).
- Chưa có `apps/web` — thuộc giai đoạn 2.

Việc tiếp theo (giai đoạn 2 — Full-stack):

1. Áp migration lên Supabase, tạo tài khoản test, gán một tài khoản làm admin.
2. Scaffold `apps/web` bằng Next.js, đăng nhập qua Supabase Auth client.
3. Trang tìm phòng trống, đặt phòng, lịch sử đặt phòng.
4. Trang admin quản lý phòng và giá theo mùa.

Cập nhật mục này sau mỗi giai đoạn theo R4.
