# PROMPT.md — Lệnh chạy trọn một giai đoạn

Dán nội dung dưới đây vào session mới. Thay `<N>` bằng số giai đoạn cần chạy.

---

Đọc RULE.md và CLAUDE.md trước khi hành động. Thực hiện trọn vẹn Giai đoạn `<N>` trong lộ trình tại CLAUDE.md, chạy liên tục cho đến khi gate của giai đoạn pass. Không dừng lại giữa chừng để hỏi ý kiến.

Chế độ tự chủ:

- Mọi quyết định kỹ thuật trong phạm vi giai đoạn, tự quyết theo R9 và ghi lý do vào ADR trong `docs/` theo R5. Không hỏi user.
- R2 vẫn áp dụng nhưng thực hiện dưới dạng văn bản, không dưới dạng câu hỏi: mỗi thành phần hạ tầng mới phải kèm phần giải thích khái niệm trong báo cáo cuối hoặc trong `docs/`.
- Chỉ dừng và hỏi khi gặp đúng ba trường hợp: hành động rủi ro hoặc tốn phí theo R11, thiếu credential mà chỉ user mới cấp được, hoặc yêu cầu mâu thuẫn trực tiếp với một rule.
- Khi bị chặn ở một hạng mục, không dừng toàn bộ. Hoàn thành mọi hạng mục còn lại, để hạng mục bị chặn ở trạng thái tối thiểu chạy được, rồi liệt kê rõ trong báo cáo.

Bắt buộc trước khi kết thúc:

1. Chạy gate của giai đoạn theo R10 bằng lệnh thật, không suy đoán.
2. Cập nhật mục Trạng thái trong CLAUDE.md theo R4.
3. Ghi ADR cho các quyết định kiến trúc theo R5.

Báo cáo cuối cùng, đúng năm phần:

1. Đã xây dựng gì. Mô tả theo tính năng, không liệt kê từng file.
2. Quyết định kỹ thuật đã chọn và lý do. Nêu cả phương án đã loại.
3. Khái niệm hạ tầng mới xuất hiện trong giai đoạn này, giải thích ngắn theo R2.
4. Kết quả xác minh gate. Dán output thật của lệnh đã chạy. Ghi rõ hạng mục nào chưa xác minh được và thiếu gì.
5. Hướng dẫn kiểm thử thủ công. Trình bày dạng các bước đánh số, gồm: lệnh chính xác cần chạy theo thứ tự, biến môi trường cần điền và lấy ở đâu, URL cần mở, tài khoản test nếu có, và kết quả mong đợi ở từng bước để user tự đối chiếu.
