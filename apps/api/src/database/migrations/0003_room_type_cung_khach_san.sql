-- 0003_room_type_cung_khach_san.sql — mot phong phai dung loai phong cua CHINH
-- khach san no thuoc ve.
--
-- VI SAO CAN:
-- 0001 chi rang buoc `rooms.room_type_id` ton tai trong bang `room_types`, khong
-- rang buoc no cung khach san. Vi the INSERT duoi day tung chay lot:
--
--   rooms(hotel_id = <khach san A>, room_type_id = <loai phong cua khach san B>)
--
-- Truy van tim phong trong join rooms -> room_types de lay suc chua va gia, nen
-- ket qua tra ve gia cua khach san B trong khi khach dang tim o khach san A.
-- Loai bug nay rat kho lan ra vi ca hai ve deu "trong co ve dung".
--
-- CACH LAM: khoa ngoai ghep. Muon tham chieu (id, hotel_id) thi phia duoc tham
-- chieu phai co mot rang buoc unique tren dung cap cot do — day la ly do ton tai
-- cua `room_types_id_hotel_unique`, du `id` da la khoa chinh. Doi lai mot index
-- phu, va database tu bao dam bat bien, khong con phu thuoc vao viec lap trinh
-- vien nho kiem tra o tang ung dung.

alter table public.room_types
  add constraint room_types_id_hotel_unique unique (id, hotel_id);

alter table public.rooms
  drop constraint if exists rooms_room_type_id_fkey;

-- `on delete no action` thay vi `restrict`: ca hai deu chan viec xoa mot loai
-- phong dang co phong, nhung `no action` kiem tra o CUOI cau lenh. Nho vay khi
-- xoa mot khach san (cascade xoa ca rooms lan room_types), rooms kip bi xoa
-- truoc luc kiem tra, thay vi bao loi giua chung nhu `restrict`.
alter table public.rooms
  add constraint rooms_room_type_cung_khach_san
  foreign key (room_type_id, hotel_id)
  references public.room_types (id, hotel_id)
  on delete no action;
