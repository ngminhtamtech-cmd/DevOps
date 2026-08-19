# RULE.md — Development Protocol

**Chỉ thị bắt buộc:** Đọc RULE.md và CLAUDE.md trước khi hành động. Mọi phản hồi phải tuân thủ toàn bộ quy tắc dưới đây. Khi một quy tắc mâu thuẫn với yêu cầu tức thời của user, nêu rõ quy tắc bị vi phạm và xin xác nhận trước khi tiếp tục. Không im lặng bỏ qua.

Bối cảnh dự án: CLAUDE.md

---

**R1 · Ngôn ngữ**
Trả lời bằng tiếng Việt. Thuật ngữ giữ tiếng Anh, giải thích nghĩa lần đầu xuất hiện. Ngắn gọn, không lặp lại.

**R2 · Giải thích trước khi code**
Với mọi thành phần hạ tầng mới (Docker, CI/CD, Kubernetes, Terraform, Ansible, Prometheus, Nginx, message queue): trình bày khái niệm và lý do dự án cần nó (tối đa 10 dòng), sau đó mới viết code, rồi giải thích những dòng dễ gây lỗi khó debug. Code ứng dụng thuần không cần giảng giải cú pháp.

**R3 · Tuần tự theo gate**
Thực hiện đúng thứ tự giai đoạn 1 đến 10. Không bắt đầu giai đoạn kế tiếp khi gate của giai đoạn hiện tại chưa pass. Không viết trước phần thuộc giai đoạn sau. Nếu user muốn nhảy cóc, nêu điều kiện tiên quyết còn thiếu rồi thực hiện theo quyết định của user.

**R4 · Cập nhật trạng thái**
Hoàn thành mỗi giai đoạn hoặc mốc lớn, cập nhật mục Trạng thái trong CLAUDE.md.

**R5 · Ghi nhận quyết định**
Mỗi quyết định kiến trúc quan trọng ghi một ADR ngắn trong `docs/`: bối cảnh, phương án đã loại, lý do chọn.

**R6 · Bí mật**
Không commit secret dưới mọi hình thức. Dùng biến môi trường; commit `.env.example` với giá trị giả, `.env` nằm trong `.gitignore`. Chạy `git status` trước khi stage diện rộng. Trên Kubernetes dùng Secret, không hardcode trong manifest. Nếu lỡ commit, báo ngay và xoay vòng key.

**R7 · Git**
Commit nhỏ, message theo `feat|fix|chore|docs|infra|ci`. Không tự push, force-push hoặc mở PR khi chưa được đồng ý. Không dùng `--no-verify`.

**R8 · Chất lượng code**
Ưu tiên dễ đọc hơn khôn khéo. Tên biến tự giải thích. Chỉ comment khi lý do không hiển nhiên. Chỉ viết phần giai đoạn hiện tại cần, không tạo abstraction dự phòng. Xử lý lỗi tại biên hệ thống. Khi có bug, truy root cause thay vì vá triệu chứng.

**R9 · Ưu tiên khả năng trình bày**
Khi hai phương án tương đương, chọn phương án user giải thích được trong phỏng vấn.

**R10 · Xác minh trước khi kết luận**
Không báo hoàn thành khi chưa chạy thử. Backend chạy test và gọi endpoint thật; frontend thao tác trên trình duyệt; hạ tầng chạy lệnh thật. Nếu không thể xác minh, nêu rõ đang thiếu gì, không tuyên bố đã hoạt động.

**R11 · Xác nhận trước hành động rủi ro**
Hỏi và chờ đồng ý trước khi: xoá file hoặc branch, `git reset --hard`, `git clean`, push, mở PR, tạo tài nguyên tốn phí (kèm ước tính chi phí tháng), `terraform destroy`, cài phần mềm cấp hệ thống.

**R12 · Chống double-booking**
Xử lý tại tầng database bằng transaction kết hợp lock hoặc exclusion constraint trên daterange. Bắt buộc có test chứng minh hai request đồng thời cùng phòng cùng khoảng ngày chỉ một request thành công.

**R13 · Chi phí**
Ưu tiên phương án miễn phí. Học Kubernetes trên kind hoặc minikube trước khi dùng VPS thật. Dùng free tier Supabase, Vercel, GitHub Actions. VPS chỉ bật khi thực hành và xoá sau khi xong. Báo chi phí ước tính trước khi đề xuất tài nguyên trả phí.
