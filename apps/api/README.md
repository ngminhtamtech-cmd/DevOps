# @t-hotel/api

REST API của T_Hotel. NestJS + Postgres (`pg`, SQL thuần) + Supabase Auth.

## Chạy trên máy (không cần Docker, không cần mật khẩu Supabase)

```bash
# terminal 1 — Postgres cục bộ, giữ dữ liệu giữa các lần chạy
npm run db:local

# terminal 2
cp ../../.env.example .env      # rồi sửa DATABASE_URL trỏ về cổng 55432
npm run db:migrate
npm run db:seed
npm run build && npm start
```

API lắng nghe ở `http://localhost:3001/api`.

## Chạy với Supabase

Đặt `DATABASE_URL` là connection string của Supabase (Dashboard → Project Settings →
Database → Connection string → URI, thay `[YOUR-PASSWORD]`), `DATABASE_SSL=true`, và
`SUPABASE_JWT_SECRET` lấy ở Project Settings → API Keys → JWT Keys. Sau đó `npm run db:migrate`.

Migration `0002` bật Row Level Security cho mọi bảng trong `public` và **không** tạo policy
nào. API kết nối bằng role chủ sở hữu nên chạy bình thường; PostgREST (anon key nằm công
khai trong trình duyệt) thì bị chặn sạch. Xem `docs/adr/0007-bat-rls-tren-schema-public.md`.
Sau khi migrate, kiểm tra advisor bảo mật của Supabase không còn cảnh báo
"RLS disabled in public".

## Test

```bash
npm test        # unit — không cần database
npm run test:e2e  # e2e — tự dựng Postgres tạm, chạy migration, gọi HTTP thật
```

## Endpoint

| Method | Đường dẫn | Quyền |
|---|---|---|
| GET | `/api/health` | công khai |
| GET | `/api/hotels`, `/api/hotels/:id` | công khai |
| POST | `/api/hotels` | admin |
| GET | `/api/room-types?hotelId=`, `/api/room-types/:id` | công khai |
| POST | `/api/room-types` | admin |
| GET | `/api/room-types/:id/rate-plans` | công khai |
| POST | `/api/room-types/:id/rate-plans` | admin |
| GET | `/api/rooms`, `/api/rooms/:id` | công khai |
| POST / PATCH / DELETE | `/api/rooms`, `/api/rooms/:id` | admin |
| GET | `/api/availability?checkIn=&checkOut=&guests=&hotelId=&roomTypeId=` | công khai |
| GET | `/api/auth/me` | đã đăng nhập |
| POST | `/api/bookings` | đã đăng nhập |
| GET | `/api/bookings/me` | đã đăng nhập |
| GET | `/api/bookings/:id` | chủ booking hoặc admin |
| POST | `/api/bookings/:id/cancel` | chủ booking hoặc admin |

Mặc định mọi endpoint yêu cầu đăng nhập; endpoint công khai được đánh dấu `@Public()`.

## Tài liệu

- `docs/adr/` — các quyết định kiến trúc
- `docs/giai-doan-1-khai-niem.md` — giải thích khái niệm hạ tầng
