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
**Đã review toàn bộ và vá xong các lỗ hổng chặn giai đoạn 2** (2026-08-19, nhánh
`fix/stage-1-hardening`).

Đã có:

- Monorepo npm workspaces: `apps/api` (NestJS), `packages/shared-types`.
  Thứ tự `workspaces` là `packages/*` trước `apps/*` — npm chạy đúng thứ tự liệt kê, đảo lại
  thì bản clone sạch build hỏng (ADR 0001).
- Schema Postgres: `hotels`, `room_types`, `rooms`, `rate_plans`, `profiles`, `bookings`.
  Chống double-booking bằng exclusion constraint GiST trên `daterange` nửa mở `[)`, có
  `WHERE status <> 'cancelled'`. Giá theo mùa tính bằng hàm SQL `calculate_stay_price`.
- Migration `0001_init` → `0002_bat_rls` → `0003_room_type_cung_khach_san` →
  `0004_co_dinh_search_path`. RLS bật cho cả bảy bảng của `public`, không policy nào
  (ADR 0007). Khoá ngoại ghép buộc phòng dùng loại phòng của chính khách sạn nó thuộc về
  (ADR 0008). Hàm `calculate_stay_price` cố định `search_path = ''` để không bị chiếm
  quyền qua schema giả.
- Migration runner tự viết (file `.sql` đánh số + bảng `schema_migrations` có checksum).
- API: CRUD phòng và loại phòng, rate plan theo mùa, tìm phòng trống theo khoảng ngày,
  đặt phòng, xem lịch sử, huỷ, health check.
- Supabase Auth: xác minh JWT HS256, guard toàn cục mặc định đóng, role trong `public.profiles`.
- Validation toàn cục (`whitelist` + `forbidNonWhitelisted`), map lỗi Postgres sang HTTP
  (`23505` → 409, `23503`/`23001` → 409 hoặc 400, `23P01` → 409). Không đặt phòng được cho
  ngày đã qua. Migration runner giữ `pg_advisory_lock` nên nhiều instance cùng khởi động
  không giẫm lên nhau.
- Test: **26 unit + 60 e2e** trên Postgres thật (`embedded-postgres`, không cần Docker),
  gồm test đồng thời chứng minh R12 và `schema-guards.e2e-spec.ts` canh RLS + khoá ngoại
  ghép + tính idempotent của seed. Lint sạch, `npm run build` từ trạng thái sạch exit 0.
  Test dùng **ngày tương đối** (`ngayTuHomNay`), không viết cứng ngày tháng — API từ chối
  đặt phòng cho ngày đã qua nên ngày cố định sẽ làm bộ test hỏng theo thời gian.
- Rate plan mùa cao điểm trong seed cũng đặt theo ngày tương đối (hôm nay +60, kéo dài 30
  ngày) để bản demo luôn còn thấy giá theo mùa.
- Smoke test HTTP thật: `node apps/api/scripts/smoke-test.js` (18 kiểm tra).
- ADR 0001–0008 và `docs/giai-doan-1-khai-niem.md`.

Git: repo đã init, remote `origin` là `github.com/ngminhtamtech-cmd/DevOps.git`, `main` đã
push. Ba worktree cho việc đang làm: `fix/stage-1-hardening`, `chore/stage-2-supabase`,
`feat/stage-2-web` (`worktrees/`).

## Supabase (Track A)

**Schema đã được áp lên project `daxypokemqsscrradlqr`** (tên hiển thị "Lich-trinh",
region ap-south-1, Postgres 17.6), ngày 2026-08-19. Project này lúc đó hoàn toàn trống —
0 bảng, 0 migration.

Lưu ý: `.env` trước đó trỏ tới ref `lgkasgosvvmdmltzpgsk`, nhưng ref đó **không nằm trong
tài khoản Supabase đang dùng** nên không truy cập được. Nếu project cũ đó thực sự tồn tại ở
một tài khoản khác, cần quyết định giữ cái nào rồi sửa `.env` cho khớp.

Migration được áp qua Supabase MCP (không cần database password) và ghi vào
`public.schema_migrations` kèm checksum, nên `npm run db:migrate` trỏ về đây sẽ báo
"bỏ qua 4 migration đã có" chứ không chạy lại.

Kết quả advisor bảo mật sau khi áp:

- **Không còn `rls_disabled_in_public`** — lỗ hổng nghiêm trọng nhất đã đóng.
- `rls_enabled_no_policy` × 7, mức INFO: đúng thiết kế của ADR 0007 (bật RLS, không policy).
- `extension_in_public` (WARN) cho `btree_gist`: **cố ý không sửa.** Chuyển extension sang
  schema riêng sẽ khiến migration phải tạo thêm schema và quản lý `search_path` trên cả ba
  môi trường (test, dev, Supabase), và các exclusion constraint GiST viết sau này sẽ hỏng
  một cách khó hiểu nếu quên. Đổi một cảnh báo mức WARN lấy một cái bẫy thật là không đáng.
- `anon_security_definer_function_executable` (WARN) cho `public.rls_auto_enable()`:
  **hàm này không thuộc T_Hotel**, nó đã có sẵn trong project từ trước. Nó là SECURITY
  DEFINER và gọi được bằng anon key qua `/rest/v1/rpc/rls_auto_enable`. Cần xem lại nguồn
  gốc rồi `revoke execute ... from anon, authenticated` hoặc xoá hẳn.

Chưa xong / còn nợ:

- Chưa seed dữ liệu mẫu lên Supabase. Cần database password (Dashboard → Project Settings →
  Database), rồi `npm run db:seed` với `DATABASE_URL` trỏ về Supabase và `DATABASE_SSL=true`.
- Chưa tạo tài khoản test và gán một tài khoản làm admin.
- Chưa có `apps/web` — thuộc giai đoạn 2.
- Nợ kỹ thuật còn lại, đều thuộc giai đoạn sau nên chưa làm theo R3:
  - Endpoint cho trang admin giai đoạn 2: `PATCH /room-types/:id`, sửa và xoá rate plan,
    `GET /bookings` cho admin xem toàn bộ, phân trang cho các endpoint danh sách.
  - helmet, rate limit, structured JSON log, global exception filter (giai đoạn 6 và 10).
  - `calculate_stay_price` trả 0 lặng lẽ khi `room_type_id` không tồn tại. Hiện không chạm
    tới được qua API vì id luôn đọc từ hàng `rooms`; nếu giai đoạn 2 thêm luồng "đặt theo
    loại phòng" thì phải xử lý trước, không thì sinh booking 0 đồng.
  - Rate plan cùng `priority` và cùng `created_at` (chèn trong một transaction) thì thứ tự
    không xác định — ADR 0006 nói "bản ghi tạo sau thắng", đúng đa số trường hợp.

Việc tiếp theo (giai đoạn 2 — Full-stack):

1. Xác nhận project Supabase, áp migration, tạo tài khoản test, gán một tài khoản làm admin.
2. Scaffold `apps/web` bằng Next.js, đăng nhập qua Supabase Auth client.
3. Trang tìm phòng trống, đặt phòng, lịch sử đặt phòng.
4. Trang admin quản lý phòng và giá theo mùa (cần bổ sung các endpoint còn thiếu ở trên).

Cập nhật mục này sau mỗi giai đoạn theo R4.
