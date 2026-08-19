# Giai đoạn 1 — Khái niệm mới xuất hiện (R2)

Tài liệu này giải thích những thành phần hạ tầng lần đầu xuất hiện trong giai đoạn 1, kèm
lý do T_Hotel cần chúng. Mục đích là để trả lời được trong phỏng vấn, không phải để tra cứu.

---

## 1. Exclusion constraint và chỉ mục GiST

**Là gì.** `UNIQUE` nói "hai hàng không được **bằng nhau** ở cột này". Exclusion constraint
tổng quát hơn: "hai hàng không được thoả **quan hệ này** với nhau", trong đó quan hệ do ta
chọn. Với T_Hotel, quan hệ đó là "cùng `room_id` **và** hai khoảng ngày **giao nhau**".

**Vì sao dự án cần.** Đây là cách duy nhất phát biểu được "một phòng không được đặt trùng
ngày" thành một quy tắc mà database tự bảo đảm, thay vì trông chờ lập trình viên nhớ kiểm tra.

**Chỉ mục GiST.** B-tree chỉ biết sắp thứ tự nên trả lời được "bằng", "lớn hơn". Nó không
trả lời được "hai khoảng này có giao nhau không". GiST (Generalized Search Tree) là loại chỉ
mục cho phép cài đặt toán tử tuỳ ý — trong đó có `&&` (giao nhau) trên `daterange`.

**Chỗ dễ vấp.** Cần `create extension btree_gist` để trộn `=` (kiểu btree, cho cột `uuid`)
với `&&` (kiểu gist) trong cùng một constraint. Thiếu nó, Postgres báo *"data type uuid has
no default operator class for access method gist"* — thông báo này không hề gợi ý rằng chỉ
cần bật một extension.

---

## 2. `daterange` và ký hiệu nửa mở `[)`

**Là gì.** Postgres có kiểu dữ liệu khoảng. `daterange('2026-09-01','2026-09-05','[)')` nghĩa
là từ ngày 01 (bao gồm) đến ngày 05 (**không** bao gồm).

**Vì sao dự án cần.** Khách trả phòng ngày 05 buổi sáng, khách khác nhận phòng ngày 05 buổi
chiều — đúng nghiệp vụ khách sạn, không phải chồng lấn. Nếu dùng `[]` (đóng cả hai đầu),
mỗi lượt khách sẽ chặn mất một đêm bán được.

**Chỗ dễ vấp.** Quy ước `[)` phải giống hệt nhau ở **cả hai nơi**: trong exclusion constraint
và trong truy vấn tìm phòng trống. Lệch nhau thì màn hình tìm kiếm báo còn phòng nhưng đặt
lại bị từ chối — loại bug rất khó lần ra vì cả hai vế đều "trông có vẻ đúng".

---

## 3. Transaction và SQLSTATE

**Là gì.** Một transaction (`BEGIN ... COMMIT`) là nhóm lệnh hoặc thành công trọn vẹn hoặc
không để lại dấu vết nào. `SQLSTATE` là mã lỗi 5 ký tự chuẩn của SQL: `23505` trùng khoá,
`23503` sai khoá ngoại, `23P01` vi phạm exclusion constraint.

**Vì sao dự án cần.** Tạo booking đọc giá từ `rate_plans` rồi ghi vào `bookings`. Hai việc
này phải cùng thành công hoặc cùng huỷ. Và `23P01` chính là tín hiệu để API trả `409 Conflict`
thay vì `500`.

**Chỗ dễ vấp.** Bắt lỗi theo **mã** chứ đừng theo chuỗi thông báo — thông báo đổi theo phiên
bản và theo ngôn ngữ của server.

---

## 4. Connection pool

**Là gì.** Mở một kết nối Postgres tốn vài chục mili-giây. Pool giữ sẵn một nhóm kết nối và
cho các request mượn rồi trả lại.

**Vì sao dự án cần.** Nếu không, mỗi request HTTP phải bắt tay TCP + TLS + xác thực lại từ đầu.

**Chỗ dễ vấp.** Hai lỗi kinh điển: (1) quên `client.release()` sau khi mượn kết nối cho
transaction — pool cạn dần rồi treo toàn bộ API, nên `release` luôn nằm trong `finally`;
(2) không lắng nghe sự kiện `error` của pool — kết nối đang nhàn rỗi bị đứt sẽ ném
`uncaughtException` và giết cả tiến trình Node.

---

## 5. JWT và mô hình "xác minh, không phát hành"

**Là gì.** JSON Web Token gồm ba phần ngăn bởi dấu chấm: header, payload, chữ ký. Chữ ký
được tạo bằng một khoá bí mật. Ai có khoá đó thì kiểm tra được token là thật và chưa bị sửa,
mà không cần hỏi lại nơi đã phát hành.

**Vì sao dự án cần.** Supabase Auth lo đăng ký, đăng nhập, quên mật khẩu, OAuth. API của
T_Hotel chỉ cần xác minh chữ ký bằng `SUPABASE_JWT_SECRET`. Không lưu mật khẩu, không gọi
mạng thêm cho mỗi request.

**Chỗ dễ vấp.** Luôn truyền `algorithms: ['HS256']` khi verify. Bỏ trống thì thư viện chấp
nhận cả `alg: none` hoặc thuật toán khác do kẻ tấn công tự chọn trong header — đây là lỗ
hổng JWT nổi tiếng nhất. Ngoài ra secret của Supabase dùng ở dạng **chuỗi thô**, không giải
mã base64, dù nhìn nó rất giống base64.

---

## 6. Migration và checksum

**Là gì.** Migration là thay đổi schema được ghi thành file, đánh số, chạy đúng một lần và
theo đúng thứ tự. Bảng `schema_migrations` ghi lại file nào đã chạy.

**Vì sao dự án cần.** Ba môi trường (test, dev, Supabase) phải có cùng schema. Từ giai đoạn
4, CI sẽ tự chạy migration trước khi chạy test.

**Chỗ dễ vấp.** Sửa nội dung một migration đã chạy là cái bẫy phổ biến nhất: máy mình không
thấy gì lạ (file đã đánh dấu là chạy rồi), còn database mới lại có schema khác. Vì thế runner
lưu checksum SHA-256 và **báo lỗi** nếu file đổi nội dung — bắt buộc phải tạo migration mới.
