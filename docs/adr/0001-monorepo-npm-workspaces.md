# ADR 0001 — Monorepo bằng npm workspaces

Ngày: 2026-08-19 · Giai đoạn 1 · Trạng thái: Đã chấp nhận

## Bối cảnh

T_Hotel sẽ có nhiều package chạy độc lập: `apps/api`, `apps/web`, và từ giai đoạn 7 là
`notification-service` và `payment-service`. Chúng dùng chung kiểu dữ liệu domain
(`Booking`, `Room`, `BookingStatus`). Cần một cách tổ chức để các service chia sẻ code
mà không phải publish package lên registry.

## Phương án đã cân nhắc

| Phương án | Lý do loại |
|---|---|
| Nhiều repo riêng | Đổi một kiểu dữ liệu phải sửa và release nhiều repo. Với dự án một người, chi phí đồng bộ lớn hơn lợi ích. |
| pnpm workspaces | CLAUDE.md ghi rõ không dùng pnpm. |
| Nx / Turborepo | Thêm một lớp công cụ phải học và giải thích, trong khi dự án chưa có bài toán cache build hay task graph phức tạp. Vi phạm R8 (không tạo abstraction dự phòng). |
| **npm workspaces** | **Đã có sẵn trong npm 11 trên máy, không cài thêm gì. Đủ cho nhu cầu hiện tại.** |

## Quyết định

Dùng `workspaces: ["apps/*", "packages/*"]` trong `package.json` gốc. Một `node_modules`
duy nhất ở gốc (hoisting), một `package-lock.json` duy nhất.

`packages/shared-types` chỉ chứa type và hằng số, không có dependency runtime. Nó build ra
`dist/` bằng `tsc`, còn Jest ánh xạ thẳng về `src/index.ts` qua `moduleNameMapper` để chạy
test không cần build trước.

## Hệ quả

- Giai đoạn 4 (CI): một lần `npm ci` ở gốc là đủ cho mọi service.
- Giai đoạn 3 (Docker): Dockerfile phải copy cả `package-lock.json` gốc và thư mục workspace
  tương ứng, không thể chỉ copy riêng `apps/api`. Đây là cái bẫy quen thuộc của monorepo và
  sẽ được xử lý ở giai đoạn 3.
