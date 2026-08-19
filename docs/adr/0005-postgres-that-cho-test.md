# ADR 0005 — Test chạy trên Postgres thật bằng `embedded-postgres`

Ngày: 2026-08-19 · Giai đoạn 1 · Trạng thái: Đã chấp nhận

## Bối cảnh

Bảo vệ chống double-booking nằm ở tầng database (ADR 0003). Một bộ test không chạm tới
Postgres thật sẽ không chứng minh được gì. Nhưng CLAUDE.md ghi rõ máy hiện tại **chưa cài
Docker** và Docker thuộc giai đoạn 3, còn R11 yêu cầu xin phép trước khi cài phần mềm cấp
hệ thống.

## Phương án đã cân nhắc

| Phương án | Lý do loại |
|---|---|
| Mock repository | Test sẽ xanh kể cả khi exclusion constraint bị xoá. Vô nghĩa với chính thứ cần chứng minh. |
| `pg-mem` (Postgres in-memory bằng JS) | Không hỗ trợ exclusion constraint GiST, không có `btree_gist`, không có `daterange` đầy đủ. Đúng phần quan trọng nhất thì nó không mô phỏng được. |
| Testcontainers | Giải pháp chuẩn mực, nhưng cần Docker — chưa có, và cài Docker lúc này là nhảy cóc sang giai đoạn 3, vi phạm R3. |
| Trỏ test vào Supabase thật | Test song song sẽ giẫm lên nhau, `TRUNCATE` xoá dữ liệu thật, và CI cần secret production. Không chấp nhận được. |
| **`embedded-postgres`** | **Tải sẵn binary Postgres vào `node_modules`, chạy như tiến trình người dùng bình thường. Không cần Docker, không cần quyền admin.** |

## Quyết định

`test/global-setup.js` khởi động một cụm Postgres tạm ở cổng 55433, chạy đúng bộ file
migration mà production dùng, rồi đặt `DATABASE_URL` vào `process.env` để các worker Jest
kế thừa. `global-teardown.js` dừng và xoá sạch cụm đó.

Ép `initdb --encoding=UTF8 --locale=C`: mặc định của Windows tiếng Việt là WIN1252, không
lưu được tiếng Việt có dấu và khác với Supabase (UTF8).

Test e2e chạy `--runInBand` (tuần tự). Các suite dùng chung một database nên chạy song song
sẽ `TRUNCATE` giẫm lên nhau.

Cùng cơ chế được tái sử dụng cho `npm run db:local` — một Postgres dev lưu dữ liệu lâu dài,
để chạy API trên máy mà không cần Docker lẫn mật khẩu database của Supabase.

## Hệ quả

- Kết quả kiểm chứng: Postgres 18.4, có `btree_gist`, exclusion constraint hoạt động đúng.
- Bản Postgres của test (18.x) mới hơn Supabase (17.x). Chưa gặp khác biệt nào ảnh hưởng
  đến schema hiện tại, nhưng cần lưu ý.
- Giai đoạn 3 có Docker rồi thì có thể chuyển sang Testcontainers cho gần production hơn.
  Chuyển đổi chỉ đụng vào `global-setup.js`, không đụng vào bất kỳ file test nào.
