-- 0004_co_dinh_search_path.sql — co dinh search_path cho calculate_stay_price.
--
-- VI SAO CAN:
-- Ham khong khai bao `search_path` se dung search_path cua NGUOI GOI. Ke tan cong
-- nao tao duoc mot schema dung truoc `public` trong search_path co the dat vao do
-- mot bang ten `rate_plans` gia, va ham se doc bang gia do — doi gia phong ma
-- khong can sua mot dong code nao. Advisor bao mat cua Supabase bat dung loi nay
-- (`function_search_path_mutable`).
--
-- `set search_path = ''` la muc chat nhat: KHONG schema nao duoc tim ngam, moi
-- doi tuong phai ghi day du ten schema. Than ham ben duoi von da ghi day du
-- (`public.rate_plans`, `public.room_types`) nen khong phai sua gi them.
-- Rieng `pg_catalog` luon duoc tim truoc tien du search_path rong, nen
-- `coalesce`, `sum`, `generate_series` va toan tu `@>` van hoat dong binh thuong.
--
-- Noi dung ham giu nguyen y het 0001, chi them mot dong `set search_path = ''`.

create or replace function public.calculate_stay_price(
  p_room_type_id uuid,
  p_check_in     date,
  p_check_out    date
) returns bigint
language sql
stable
set search_path = ''
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
