# ADR 0002 — Truy vấn bằng `pg` và SQL thuần, không dùng ORM

Ngày: 2026-08-19 · Giai đoạn 1 · Trạng thái: Đã chấp nhận

## Bối cảnh

Nghiệp vụ lõi của T_Hotel là kiểm tra tồn phòng theo khoảng ngày và chống double-booking.
Cả hai đều dựa vào tính năng riêng của Postgres: kiểu `daterange`, toán tử giao `&&`, và
exclusion constraint dùng chỉ mục GiST.

## Phương án đã cân nhắc

| Phương án | Lý do loại |
|---|---|
| TypeORM | Không mô hình hoá được exclusion constraint; phải viết raw query cho đúng phần quan trọng nhất, tức là mất lợi ích chính của ORM mà vẫn gánh chi phí của nó. Migration tự sinh có xu hướng bỏ qua constraint viết tay và âm thầm drop chúng. |
| Prisma | Cùng vấn đề về exclusion constraint, lại thêm một engine nhị phân phải đóng gói trong Docker ở giai đoạn 3. |
| Drizzle / Kysely | Type-safe và tốt hơn hai lựa chọn trên, nhưng vẫn thêm một tầng cú pháp phải giải thích trong phỏng vấn, trong khi phần đáng nói lại chính là câu SQL. |
| **`pg` + SQL thuần** | **Câu SQL trong code chính là câu SQL chạy trên database, dán thẳng vào `psql` để debug được.** |

## Quyết định

Dùng driver `pg` với `DatabaseService` mỏng bọc quanh `Pool`, cung cấp `query`, `queryOne`
và `transaction`. Mọi câu lệnh đều tham số hoá `$1, $2` — không nối chuỗi từ input người dùng.

Mỗi module có hàm mapper riêng chuyển `snake_case` của database sang `camelCase` của API.

## Hệ quả

- Không có type safety tự động giữa schema và code. Bù lại bằng interface `*Row` khai báo tay
  cho mỗi truy vấn, và bằng test e2e chạy trên Postgres thật — sai tên cột là test đỏ ngay.
- `pg` trả kiểu `bigint` về dưới dạng chuỗi để không mất độ chính xác. Giá tiền được ép về
  `number` ngay tại biên của service, tầng trên không phải bận tâm.
- Nếu sau này số truy vấn phình to, có thể thêm Kysely mà không phải viết lại schema.
