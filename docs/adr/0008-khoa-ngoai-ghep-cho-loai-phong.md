# ADR 0008 — Khoá ngoại ghép: phòng phải dùng loại phòng của chính khách sạn nó thuộc về

Ngày: 2026-08-19 · Giai đoạn 1 (hardening trước giai đoạn 2) · Trạng thái: Đã chấp nhận

## Bối cảnh

Bảng `rooms` mang cả `hotel_id` lẫn `room_type_id`. Schema 0001 chỉ ràng buộc từng cột một:
`hotel_id` phải tồn tại trong `hotels`, `room_type_id` phải tồn tại trong `room_types`.
Không có gì buộc hai cột đó **nhất quán với nhau**, nên hàng dưới đây từng chèn được:

```
rooms(hotel_id = <khách sạn A>, room_type_id = <loại phòng của khách sạn B>)
```

Truy vấn tìm phòng trống join `rooms → room_types` để lấy sức chứa và giá. Với hàng lệch
như trên, khách tìm phòng ở khách sạn A sẽ nhận về giá và sức chứa của khách sạn B. Giai
đoạn 1 chỉ có một khách sạn nên chưa lộ; giai đoạn 2 có trang admin tạo phòng thì lộ ngay.

Loại lỗi này khó lần ra vì cả hai vế đều "trông có vẻ đúng" — giống hệt cái bẫy `[)` mà
ADR 0003 đã nêu.

## Phương án đã cân nhắc

| Phương án | Lý do loại |
|---|---|
| Kiểm tra ở `RoomsService` trước khi ghi | Bảo vệ nằm ở chỗ lập trình viên nhớ viết. Quên một đường ghi (seed, migration sửa dữ liệu, script vận hành) là thủng. Cùng lý lẽ đã dùng để loại `SELECT ... FOR UPDATE` ở ADR 0003. |
| Bỏ hẳn `rooms.hotel_id`, suy ra từ `room_types.hotel_id` | Chuẩn hoá hơn thật, nhưng mọi truy vấn lọc theo khách sạn đều phải join thêm một bảng, kể cả truy vấn tìm phòng trống vốn chạy nhiều nhất. Và đây là thay đổi lan rộng ngay trước giai đoạn 2. |
| Trigger kiểm tra trước khi ghi | Làm được, nhưng trigger là code ẩn: đọc schema không thấy ràng buộc, debug khó hơn hẳn một dòng khoá ngoại. |
| **Khoá ngoại ghép `(room_type_id, hotel_id)`** | **Database tự bảo đảm bất biến, hiện rõ ngay trong `\d rooms`, không tốn thêm truy vấn nào lúc đọc.** |

## Quyết định

Migration `0003_room_type_cung_khach_san.sql`:

```sql
alter table public.room_types
  add constraint room_types_id_hotel_unique unique (id, hotel_id);

alter table public.rooms
  drop constraint if exists rooms_room_type_id_fkey;

alter table public.rooms
  add constraint rooms_room_type_cung_khach_san
  foreign key (room_type_id, hotel_id) references public.room_types (id, hotel_id)
  on delete no action;
```

Hai chi tiết dễ vấp:

- **`unique (id, hotel_id)` trông thừa** vì `id` đã là khoá chính. Nhưng Postgres đòi phía
  được tham chiếu phải có ràng buộc unique trên **đúng cặp cột** được tham chiếu, nên
  không có nó thì khoá ngoại ghép không tạo được. Giá phải trả là một index phụ.
- **`no action` thay cho `restrict`**: cả hai đều chặn việc xoá một loại phòng đang có
  phòng, nhưng `no action` kiểm tra ở cuối câu lệnh. Nhờ vậy khi xoá một khách sạn (cascade
  xoá cả `rooms` lẫn `room_types`), `rooms` kịp bị xoá trước lúc kiểm tra, thay vì báo lỗi
  giữa chừng như `restrict`.

Ở tầng API, `23503` được đổi thành **400** kèm thông điệp nêu cả hai khả năng (id không tồn
tại, hoặc loại phòng thuộc khách sạn khác) — trước đây là 404, không đúng nghĩa vì lỗi nằm
ở body chứ không ở URL.

## Hệ quả

- Dữ liệu cũ đang lệch sẽ làm migration `0003` thất bại. Đúng ý muốn: sai lệch phải lộ ra
  lúc migrate chứ không âm thầm tồn tại.
- Đổi `room_type_id` của một phòng sang loại phòng của khách sạn khác giờ là 400, kể cả khi
  gọi thẳng SQL — `schema-guards.e2e-spec.ts` kiểm chứng cả hai đường.
