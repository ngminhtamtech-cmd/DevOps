-- 0001_init.sql — schema goc cua T_Hotel
-- Chay duoc tren ca Supabase Postgres lan Postgres thuan (test/CI).

-- gen_random_uuid() nam trong pgcrypto o Postgres < 13; tu 13 tro len da co san trong core.
create extension if not exists pgcrypto;
-- btree_gist cho phep tron toan tu "=" (kieu btree) voi toan tu "&&" (kieu gist)
-- trong CUNG mot exclusion constraint. Khong co no, rang buoc chong double-booking
-- ben duoi se bao loi "data type uuid has no default operator class for access method gist".
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Khach san
-- ---------------------------------------------------------------------------
create table if not exists public.hotels (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  address     text        not null,
  city        text        not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Loai phong (single / double / suite). Gia goc nam o day.
-- ---------------------------------------------------------------------------
create table if not exists public.room_types (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels (id) on delete cascade,
  code             text not null,
  name             text not null,
  capacity         int  not null,
  base_price_cents bigint not null,
  created_at       timestamptz not null default now(),
  constraint room_types_code_per_hotel_unique unique (hotel_id, code),
  constraint room_types_capacity_positive check (capacity > 0),
  constraint room_types_price_non_negative check (base_price_cents >= 0)
);

-- ---------------------------------------------------------------------------
-- Phong vat ly
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels (id) on delete cascade,
  room_type_id uuid not null references public.room_types (id) on delete restrict,
  room_number  text not null,
  floor        int,
  status       text not null default 'available',
  created_at   timestamptz not null default now(),
  constraint rooms_number_per_hotel_unique unique (hotel_id, room_number),
  constraint rooms_status_allowed check (status in ('available', 'maintenance'))
);

create index if not exists rooms_hotel_id_idx on public.rooms (hotel_id);
create index if not exists rooms_room_type_id_idx on public.rooms (room_type_id);

-- ---------------------------------------------------------------------------
-- Gia theo mua / theo ngay.
-- Mot rate_plan phu mot khoang ngay; priority cao hon thang khi cac khoang chong nhau.
-- valid_range dung daterange nua mo [start, end) cho dong nhat voi cach tinh dem.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_plans (
  id           uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  name         text not null,
  valid_range  daterange not null,
  price_cents  bigint not null,
  priority     int not null default 0,
  created_at   timestamptz not null default now(),
  constraint rate_plans_price_non_negative check (price_cents >= 0),
  constraint rate_plans_range_not_empty check (not isempty(valid_range))
);

create index if not exists rate_plans_room_type_range_idx
  on public.rate_plans using gist (room_type_id, valid_range);

-- ---------------------------------------------------------------------------
-- Ho so nguoi dung. id trung voi auth.users.id cua Supabase Auth.
-- Khong dat khoa ngoai sang auth.users de schema chay duoc tren Postgres thuan
-- (test/CI khong co schema auth). Xem docs/adr/0004-supabase-auth-jwt.md.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key,
  email      text,
  full_name  text,
  role       text not null default 'customer',
  created_at timestamptz not null default now(),
  constraint profiles_role_allowed check (role in ('customer', 'admin'))
);

-- ---------------------------------------------------------------------------
-- Booking — trai tim cua R12 (chong double-booking).
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms (id) on delete restrict,
  user_id           uuid not null,
  guest_name        text not null,
  guest_email       text not null,
  check_in          date not null,
  check_out         date not null,
  nights            int generated always as (check_out - check_in) stored,
  status            text not null default 'pending',
  total_price_cents bigint not null,
  created_at        timestamptz not null default now(),
  cancelled_at      timestamptz,
  constraint bookings_status_allowed check (status in ('pending', 'confirmed', 'cancelled')),
  constraint bookings_dates_ordered check (check_out > check_in),
  constraint bookings_total_non_negative check (total_price_cents >= 0),

  -- R12: hai booking cua CUNG mot phong khong duoc giao nhau ve khoang ngay.
  -- daterange '[)' = bao gom check_in, khong bao gom check_out => khach tra phong
  -- ngay 05 va khach khac nhan phong ngay 05 la HOP LE, khong bi coi la chong lan.
  -- Menh de WHERE khien booking da huy khong con chiem cho.
  -- Postgres tu dong khoa o muc index: hai transaction dong thoi chen cung khoang
  -- se co mot cai bi chan, cho, roi that bai voi SQLSTATE 23P01.
  constraint bookings_no_double_booking exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status <> 'cancelled')
);

create index if not exists bookings_user_id_idx on public.bookings (user_id);
create index if not exists bookings_room_id_idx on public.bookings (room_id);

-- ---------------------------------------------------------------------------
-- Tinh gia mot ky nghi: cong gia tung dem, uu tien rate_plan co priority cao nhat.
-- Dat o tang database de query tim phong trong va luc tao booking dung CHUNG mot
-- nguon su that ve gia, tranh lech gia giua man hinh tim kiem va hoa don.
-- ---------------------------------------------------------------------------
create or replace function public.calculate_stay_price(
  p_room_type_id uuid,
  p_check_in     date,
  p_check_out    date
) returns bigint
language sql
stable
as $$
  select coalesce(sum(night_price), 0)::bigint
  from (
    select coalesce(
             (select rp.price_cents
              from public.rate_plans rp
              where rp.room_type_id = p_room_type_id
                and rp.valid_range @> night::date
              order by rp.priority desc, rp.created_at desc
              limit 1),
             rt.base_price_cents
           ) as night_price
    from public.room_types rt
    cross join generate_series(p_check_in, p_check_out - 1, interval '1 day') as night
    where rt.id = p_room_type_id
  ) nights;
$$;
