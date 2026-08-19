-- 0002_bat_rls.sql — bat Row Level Security cho moi bang nghiep vu.
--
-- VI SAO CAN:
-- Tren Supabase, moi bang trong schema `public` deu duoc PostgREST expose ra
-- Internet, va role `anon` / `authenticated` co san quyen CRUD mac dinh. Anon key
-- nam cong khai trong ma nguon trinh duyet cua apps/web (giai doan 2). Neu khong
-- bat RLS thi bat ky ai mo DevTools cung co the goi thang:
--
--   PATCH /rest/v1/profiles?id=eq.<chinh minh>   body {"role":"admin"}
--
-- roi tro thanh admin that, vi API tra role trong chinh bang nay. Toan bo
-- RolesGuard tro nen vo nghia. Doc trom bang bookings (ten, email khach) cung chi
-- la mot cau GET.
--
-- CACH LAM: bat RLS nhung KHONG tao policy nao.
-- - Chu so huu bang (role `postgres`, cung la role API dung de ket noi) duoc
--   MIEN RLS, nen API chay binh thuong, khong doi mot dong code nao.
-- - Moi role khac (`anon`, `authenticated` cua PostgREST) khong khop policy nao
--   nen khong doc/ghi duoc gi. Mac dinh dong, giong triet ly cua SupabaseJwtGuard.
--
-- HE QUA CAN NHO: neu sau nay API doi sang ket noi bang role KHONG phai chu so
-- huu, moi truy van se tra ve rong ma khong bao loi. Luc do phai viet policy,
-- hoac dung `alter table ... force row level security` de chinh chu so huu cung
-- bi rang buoc — nho vay quen viet policy se thanh loi ro rang thay vi im lang.
--
-- Lenh nay idempotent: bat lai tren bang da bat khong gay loi.

-- schema_migrations do chinh migration runner tao ra truoc khi chay file nay, va
-- no cung nam trong schema `public` nen cung bi PostgREST expose. Noi dung khong
-- nhay cam nhung khong co ly do gi de mo.
alter table public.schema_migrations enable row level security;

alter table public.hotels      enable row level security;
alter table public.room_types  enable row level security;
alter table public.rooms       enable row level security;
alter table public.rate_plans  enable row level security;
alter table public.profiles    enable row level security;
alter table public.bookings    enable row level security;
