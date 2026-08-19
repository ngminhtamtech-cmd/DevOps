# ADR 0004 — Xác thực bằng JWT của Supabase Auth, phân quyền trong `public.profiles`

Ngày: 2026-08-19 · Giai đoạn 1 · Trạng thái: Đã chấp nhận

## Bối cảnh

CLAUDE.md chốt dùng Supabase cho Postgres và Auth. Cần quyết định API xác thực người dùng
thế nào và lưu vai trò `customer` / `admin` ở đâu.

## Phương án đã cân nhắc

| Phương án | Lý do loại |
|---|---|
| API tự quản lý mật khẩu (bcrypt, bảng `users`) | Viết lại thứ Supabase đã làm tốt hơn: xác minh email, quên mật khẩu, OAuth, rate limit. Tự lưu mật khẩu còn là gánh nặng bảo mật không cần thiết cho một dự án portfolio. |
| Gọi `GET /auth/v1/user` của Supabase mỗi request | Thêm một round-trip mạng cho mọi request. JWT vốn tự chứa và tự chứng minh — không cần hỏi lại nơi phát hành. |
| Lưu role trong `app_metadata` của JWT | Đổi quyền một người phải phát hành lại token, và người đó vẫn giữ quyền cũ cho tới khi token cũ hết hạn. Ngoài ra sửa `app_metadata` cần service-role key. |
| Khoá ngoại `profiles.id → auth.users(id)` | Đúng chuẩn Supabase, nhưng schema sẽ không chạy được trên Postgres thuần vì không có schema `auth`. Mà test e2e và CI (giai đoạn 4) lại chạy trên Postgres thuần. |

## Quyết định

**Xác thực:** client gọi Supabase Auth để lấy access token; API chỉ **xác minh** chữ ký
HS256 bằng `SUPABASE_JWT_SECRET`, kiểm tra hạn dùng và `aud = 'authenticated'`. API không
bao giờ phát hành token.

**Phân quyền:** vai trò lưu ở `public.profiles.role`, là nguồn sự thật duy nhất. Đổi quyền
có hiệu lực ngay ở request kế tiếp, không phải chờ token hết hạn.

**Liên kết:** `profiles.id` mang đúng giá trị `auth.users.id` nhưng **không** đặt khoá ngoại.
Hồ sơ được tạo tự động (`findOrCreate`) trong lần đầu người dùng gọi API, thay vì bằng
trigger trên `auth.users`.

**Mặc định đóng:** `SupabaseJwtGuard` đăng ký toàn cục qua `APP_GUARD`. Mọi endpoint đều
yêu cầu đăng nhập trừ khi đánh dấu `@Public()`. Quên decorator thì endpoint bị khoá, chứ
không bị hở.

## Hệ quả

- Mất ràng buộc toàn vẹn tham chiếu: xoá user trên Supabase không tự xoá `profiles`. Chấp
  nhận đánh đổi để schema chạy được ở mọi nơi; dọn dữ liệu mồ côi là việc của giai đoạn sau.
- `SUPABASE_JWT_SECRET` được dùng ở dạng **chuỗi UTF-8 thô**, không giải mã base64 — đã xác
  minh bằng chính token của project.
- Test tự ký token bằng cùng thuật toán và cùng secret của môi trường test. Điều được kiểm
  chứng là API **xác minh** token đúng; việc phát hành token là trách nhiệm của Supabase.
- Nếu sau này project chuyển sang khoá bất đối xứng (ES256 + JWKS), chỉ phải sửa phần
  `verifyToken` trong guard.
