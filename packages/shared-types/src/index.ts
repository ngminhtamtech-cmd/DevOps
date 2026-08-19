/**
 * Kieu du lieu domain dung chung giua apps/api va apps/web.
 * Chi chua type + hang so, khong chua logic va khong phu thuoc runtime nao.
 */

export const USER_ROLES = ['customer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROOM_STATUSES = ['available', 'maintenance'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ROOM_TYPE_CODES = ['single', 'double', 'suite'] as const;
export type RoomTypeCode = (typeof ROOM_TYPE_CODES)[number];

/** Ngay dang chuoi ISO `YYYY-MM-DD` (khong kem gio, tranh lech mui gio). */
export type IsoDate = string;

export interface Hotel {
  id: string;
  name: string;
  address: string;
  city: string;
  createdAt: string;
}

export interface RoomType {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  capacity: number;
  basePriceCents: number;
}

export interface Room {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
}

/** Mot phong con trong cho khoang ngay da hoi, kem gia da tinh theo mua. */
export interface AvailableRoom extends Room {
  roomTypeCode: string;
  roomTypeName: string;
  capacity: number;
  nights: number;
  totalPriceCents: number;
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  guestName: string;
  guestEmail: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  status: BookingStatus;
  totalPriceCents: number;
  createdAt: string;
  cancelledAt: string | null;
}
