# ADR 0006 — Migration bằng file SQL tự quản lý, giá theo mùa tính bằng hàm SQL

Ngày: 2026-08-19 · Giai đoạn 1 · Trạng thái: Đã chấp nhận

## Phần A — Migration

### Bối cảnh

Schema phải áp dụng được lên ba nơi: Postgres tạm của test, Postgres dev trên máy, và
Supabase. Cùng một schema, cùng một thứ tự.

### Phương án đã cân nhắc

| Phương án | Lý do loại |
|---|---|
| Supabase CLI (`supabase db push`) | Buộc phải có Supabase CLI và liên kết project mới chạy được test cục bộ và CI. Ràng buộc CI vào một nhà cung cấp cụ thể. |
| Migration tự sinh từ ORM | Đã loại ORM ở ADR 0002. Ngoài ra công cụ tự sinh hay bỏ sót exclusion constraint viết tay. |
| `node-pg-migrate`, `umzug` | Dùng được, nhưng migration ở đây chỉ là file SQL chạy theo thứ tự — khoảng 60 dòng là đủ, và tự viết thì giải thích được từng dòng trong phỏng vấn (R9). |
| **File `.sql` đánh số + bảng `schema_migrations`** | **Đơn giản, không phụ thuộc nhà cung cấp, dán vào `psql` cũng chạy được.** |

### Quyết định

File đặt tên `NNNN_ten.sql`, chạy theo thứ tự tên. Mỗi file chạy trong một transaction
riêng và được ghi vào `public.schema_migrations` kèm **checksum SHA-256**.

Sửa nội dung một migration đã chạy sẽ làm runner báo lỗi, thay vì âm thầm bỏ qua. Đây là
cách chặn tình huống database dev và database production lệch schema mà không ai biết.

## Phần B — Giá thay đổi theo mùa và theo ngày

### Bối cảnh

CLAUDE.md nêu "giá thay đổi theo mùa và theo ngày". Giá được dùng ở hai chỗ: kết quả tìm
phòng trống, và tổng tiền lúc tạo booking.

### Quyết định

Bảng `rate_plans` gắn với `room_type`, mỗi bản ghi phủ một `daterange` kèm `priority`.
Không có rate plan nào phủ thì dùng `room_types.base_price_cents`.

Việc tính tổng đặt trong hàm SQL `public.calculate_stay_price(room_type_id, check_in,
check_out)`: cộng giá từng đêm, mỗi đêm lấy rate plan có `priority` cao nhất đang phủ ngày đó.

Lý do đặt ở tầng database chứ không ở TypeScript: cả truy vấn tìm phòng trống lẫn lệnh tạo
booking đều gọi **cùng một hàm**, nên giá hiển thị và giá tính tiền không thể lệch nhau.
Nếu tính ở tầng ứng dụng, truy vấn tìm kiếm sẽ phải kéo toàn bộ `rate_plans` về rồi lặp
trong JavaScript cho từng phòng.

Tiền lưu bằng **đơn vị nhỏ nhất (cents), kiểu `bigint`** — không dùng số thực. `0.1 + 0.2`
trong dấu chấm động không bằng `0.3`, và tiền là chỗ không được phép sai số.

### Hệ quả

- Sửa công thức giá phải viết migration mới, không chỉ deploy lại code.
- Rate plan cho phép chồng lấn nhau; `priority` là trọng tài. Bằng giá `priority` thì bản
  ghi tạo sau thắng.
