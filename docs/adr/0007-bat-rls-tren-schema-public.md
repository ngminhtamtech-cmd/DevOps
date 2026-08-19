# ADR 0007 — Bật Row Level Security trên toàn bộ schema `public`

Ngày: 2026-08-19 · Giai đoạn 1 (hardening trước giai đoạn 2) · Trạng thái: Đã chấp nhận · Liên quan: ADR 0004

## Bối cảnh

ADR 0004 chốt mô hình phân quyền: JWT do Supabase Auth phát hành, vai trò lưu ở
`public.profiles.role`, và `RolesGuard` của API là nơi chặn. Mô hình đó chỉ đúng **nếu
đường duy nhất chạm tới database là API của T_Hotel**.

Trên Supabase thì không phải vậy. Mọi bảng trong schema `public` được PostgREST tự động
expose ra Internet tại `https://<ref>.supabase.co/rest/v1/<bảng>`, và hai role `anon` /
`authenticated` có sẵn quyền CRUD mặc định. Giai đoạn 2 sẽ nhúng anon key vào `apps/web` —
tức là công khai, ai mở DevTools cũng lấy được.

Hệ quả nếu để nguyên: bất kỳ ai cũng gọi được

```
PATCH /rest/v1/profiles?id=eq.<chính mình>     body: {"role":"admin"}
```

rồi trở thành admin thật, vì API tra role trong đúng bảng đó. Toàn bộ `RolesGuard` bị vô
hiệu hoá mà không cần chạm vào API. Đọc trộm `bookings` (tên, email khách) chỉ là một câu
`GET`. Đây là lỗ hổng nghiêm trọng nhất của giai đoạn 1.

## Phương án đã cân nhắc

| Phương án | Lý do loại |
|---|---|
| Không làm gì, coi API là cổng duy nhất | Sai tiền đề: PostgREST luôn bật, không tắt được từ phía ứng dụng. |
| `revoke all on all tables from anon, authenticated` | Có chặn được, nhưng đi ngược mô hình của Supabase: `default privileges` sẽ cấp lại quyền cho bảng tạo sau, nên mỗi migration mới lại phải nhớ revoke. Quên một lần là hở. Advisor bảo mật của Supabase cũng không hiểu cách này. |
| Viết policy đầy đủ cho `anon` / `authenticated` | Đúng khi client nói chuyện thẳng với Postgres. Nhưng T_Hotel đã chọn kiến trúc client → API → database (ADR 0002, 0004). Viết policy tức là duy trì **hai** bộ luật phân quyền song song, luôn có nguy cơ lệch nhau. |
| **Bật RLS, không tạo policy nào** | **Chủ sở hữu bảng được miễn RLS, nên API chạy nguyên vẹn. Mọi role khác không khớp policy nào nên không đọc/ghi được gì.** |

## Quyết định

Migration `0002_bat_rls.sql`: `enable row level security` cho cả bảy bảng của schema
`public` (sáu bảng nghiệp vụ + `schema_migrations`), **không tạo policy nào**.

Cơ chế: API kết nối bằng role `postgres`, cũng là chủ sở hữu bảng, và chủ sở hữu được miễn
RLS. PostgREST dùng `anon` / `authenticated` — không khớp policy nào nên bị chặn sạch.
Cùng một triết lý "mặc định đóng" với `SupabaseJwtGuard`: quên khai báo thì bị khoá, chứ
không bị hở.

## Hệ quả

- Nếu về sau API đổi sang kết nối bằng role **không phải** chủ sở hữu (thực hành tốt cho
  production), mọi truy vấn sẽ trả về rỗng **mà không báo lỗi**. Lúc đó bắt buộc phải viết
  policy. Cân nhắc `force row level security` để chính chủ sở hữu cũng bị ràng buộc — khi
  đó quên viết policy sẽ thành lỗi ồn ào ngay từ test thay vì im lặng.
- Bảng mới trong các migration sau **phải** được bật RLS trong cùng migration. Test
  `schema-guards.e2e-spec.ts` quét `pg_class` và đỏ ngay nếu có bảng nào trong `public`
  chưa bật, nên không cần trông vào trí nhớ.
- Sau khi áp schema lên Supabase, chạy advisor bảo mật để xác nhận không còn cảnh báo
  "RLS disabled in public".

## Kiểm chứng trên Supabase (2026-08-19)

Đã áp lên project `daxypokemqsscrradlqr`. Advisor bảo mật: **không còn
`rls_disabled_in_public`**. Thay vào đó là 7 dòng `rls_enabled_no_policy` ở mức **INFO** —
đúng bằng số bảng, và đúng là trạng thái mà ADR này chọn.

Cảnh báo đó nói "bật RLS mà không có policy nào thì không ai đọc được gì". Với kiến trúc
client → API → database của T_Hotel thì đó chính là điều mong muốn: API kết nối bằng role
chủ sở hữu nên không bị ảnh hưởng, còn PostgREST thì phải bị chặn. Nếu sau này có màn hình
nào gọi thẳng Supabase từ trình duyệt, lúc đó mới cần viết policy cho đúng bảng đó.
