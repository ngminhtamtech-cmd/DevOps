# ADR 0003 — Chống double-booking bằng exclusion constraint trên `daterange`

Ngày: 2026-08-19 · Giai đoạn 1 · Trạng thái: Đã chấp nhận · Liên quan: R12

## Bối cảnh

Yêu cầu cứng của dự án (R12): hai request đồng thời đặt cùng một phòng trong cùng khoảng
ngày thì chỉ một request được thành công. Đây là bài toán kinh điển và là điểm nhấn khi
phỏng vấn, nên cách giải phải vừa đúng vừa giải thích được.

## Phương án đã cân nhắc

### 1. Kiểm tra rồi mới ghi ở tầng ứng dụng (loại)

```
SELECT ... WHERE overlap   -- không thấy trùng
INSERT INTO bookings ...
```

Giữa `SELECT` và `INSERT` có một khe thời gian. Hai request cùng chạy `SELECT`, cả hai
đều thấy trống, cả hai đều `INSERT`. Đây là **phantom read** và ngay cả mức cô lập
`REPEATABLE READ` của Postgres cũng không chặn được, vì hàng gây xung đột chưa tồn tại tại
thời điểm đọc nên không có gì để khoá.

### 2. `SELECT ... FOR UPDATE` trên hàng `rooms` (loại)

Khoá hàng phòng trước khi ghi booking thì có chặn được, nhưng nó khoá **toàn bộ phòng**
chứ không phải khoảng ngày: hai khách đặt cùng phòng ở hai tháng hoàn toàn khác nhau vẫn
phải xếp hàng chờ nhau. Ngoài ra bảo vệ nằm ở việc lập trình viên nhớ viết `FOR UPDATE`;
quên một chỗ là thủng.

### 3. Bảng khoá riêng hoặc Redis lock (loại)

Thêm một thành phần hạ tầng nữa để giải bài toán mà chính database đã giải sẵn. Khoá phân
tán còn kéo theo vấn đề riêng của nó (khoá hết hạn giữa chừng, clock skew). Vi phạm R8.

### 4. Exclusion constraint GiST (chọn)

```sql
constraint bookings_no_double_booking exclude using gist (
  room_id with =,
  daterange(check_in, check_out, '[)') with &&
) where (status <> 'cancelled')
```

## Quyết định

Đặt bảo vệ ở **tầng database**, dùng exclusion constraint. Tầng ứng dụng `INSERT` thẳng,
không kiểm tra trước, và bắt `SQLSTATE 23P01` để đổi thành `HTTP 409 Conflict`.

Ba chi tiết quan trọng:

- **`'[)'` — nửa mở.** Bao gồm ngày nhận phòng, không bao gồm ngày trả phòng. Nhờ vậy khách
  trả phòng ngày 05 và khách khác nhận phòng ngày 05 không bị coi là chồng lấn. Dùng `'[]'`
  sẽ mất một đêm bán được của mỗi lượt khách.
- **`WHERE status <> 'cancelled'`.** Booking đã huỷ không còn giữ chỗ, khoảng ngày mở lại ngay.
- **`btree_gist`.** Cần extension này để trộn toán tử `=` (kiểu btree, cho `room_id`) với
  `&&` (kiểu gist, cho `daterange`) trong cùng một constraint.

Truy vấn tìm phòng trống dùng **đúng cùng công thức** `daterange(..., '[)') &&`. Nếu hai nơi
định nghĩa lệch nhau, màn hình tìm kiếm sẽ báo còn phòng nhưng khi đặt lại bị từ chối.

## Cách Postgres bảo đảm tính đúng

Exclusion constraint được bảo đảm bởi một chỉ mục GiST. Khi transaction A chèn một hàng,
Postgres ghi khoá lên chỉ mục đó. Transaction B chèn khoảng ngày giao nhau sẽ bị **chặn và
chờ** cho tới khi A kết thúc: A commit thì B nhận `23P01`, A rollback thì B đi tiếp. Không
có khe hở nào cho cả hai cùng thành công.

## Bằng chứng

`apps/api/test/double-booking.e2e-spec.ts` chạy trên Postgres thật:

- hai request HTTP đồng thời → đúng một `201`, một `409`;
- năm request đồng thời → đúng một `201`, bốn `409`;
- bốn kiểu chồng lấn (dưới, trên, nằm trong, bao trùm) đều `409`;
- nhận phòng đúng ngày trả phòng → `201`;
- một test đi thẳng xuống tầng database, hai transaction song song, khẳng định transaction
  thứ hai nhận đúng `SQLSTATE 23P01` — chứng minh bảo vệ nằm ở database chứ không ở code.

## Hệ quả

- Nếu ai đó xoá constraint trong migration, test đỏ ngay cả khi toàn bộ TypeScript giữ nguyên.
- Đổi lịch (giai đoạn sau) phải `UPDATE` trong transaction và cũng sẽ chạm đúng constraint này.
- Giai đoạn 7 tách payment-service: booking `pending` vẫn giữ chỗ, nên cần cơ chế hết hạn
  booking chưa thanh toán, nếu không phòng bị giữ vô thời hạn.
