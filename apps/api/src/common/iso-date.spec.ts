import { BadRequestException } from '@nestjs/common';
import {
  assertCheckInKhongThuocQuaKhu,
  assertValidStayRange,
  countNights,
  homNayIso,
  isIsoDateString,
  MAX_STAY_NIGHTS,
} from './iso-date';

function ngayTuHomNay(soNgay: number): string {
  const ngay = new Date();
  ngay.setUTCDate(ngay.getUTCDate() + soNgay);
  return ngay.toISOString().slice(0, 10);
}

describe('isIsoDateString', () => {
  it.each(['2026-01-01', '2026-12-31', '2028-02-29'])('chap nhan ngay hop le %s', (value) => {
    expect(isIsoDateString(value)).toBe(true);
  });

  it.each([
    '2026-02-30', // ngay khong ton tai
    '2026-13-01', // thang khong ton tai
    '2026-1-1', // thieu so 0
    '2026/01/01', // sai dau phan cach
    '2026-01-01T00:00:00Z', // co kem gio
    '',
    'hom nay',
  ])('tu choi gia tri khong hop le %s', (value) => {
    expect(isIsoDateString(value)).toBe(false);
  });

  it('tu choi gia tri khong phai chuoi', () => {
    expect(isIsoDateString(20260101)).toBe(false);
    expect(isIsoDateString(null)).toBe(false);
    expect(isIsoDateString(new Date())).toBe(false);
  });
});

describe('countNights', () => {
  it('dem so dem giua hai ngay', () => {
    expect(countNights('2026-10-01', '2026-10-04')).toBe(3);
    expect(countNights('2026-10-01', '2026-10-02')).toBe(1);
  });

  it('khong bi lech khi khoang ngay di qua moc doi gio mua he', () => {
    // Nhieu mui gio doi gio vao cuoi thang 3; neu tinh bang gio dia phuong,
    // khoang nay se ra 6.958... dem va bi lam tron sai.
    expect(countNights('2026-03-28', '2026-04-04')).toBe(7);
  });

  it('tra so am khi ngay tra truoc ngay nhan', () => {
    expect(countNights('2026-10-04', '2026-10-01')).toBe(-3);
  });
});

describe('assertValidStayRange', () => {
  it('tra ve so dem khi khoang ngay hop le', () => {
    expect(assertValidStayRange('2026-10-01', '2026-10-04')).toBe(3);
  });

  it('tu choi khi ngay tra khong sau ngay nhan', () => {
    expect(() => assertValidStayRange('2026-10-04', '2026-10-04')).toThrow(BadRequestException);
    expect(() => assertValidStayRange('2026-10-04', '2026-10-01')).toThrow(BadRequestException);
  });

  it(`tu choi ky nghi dai hon ${MAX_STAY_NIGHTS} dem`, () => {
    expect(() => assertValidStayRange('2026-10-01', '2026-11-05')).toThrow(BadRequestException);
    // Dung bang gioi han thi van chap nhan
    expect(assertValidStayRange('2026-10-01', '2026-10-31')).toBe(MAX_STAY_NIGHTS);
  });
});

describe('assertCheckInKhongThuocQuaKhu', () => {
  it('tu choi ngay truoc hom nay', () => {
    expect(() => assertCheckInKhongThuocQuaKhu(ngayTuHomNay(-1))).toThrow(BadRequestException);
    expect(() => assertCheckInKhongThuocQuaKhu('2020-01-01')).toThrow(BadRequestException);
  });

  it('chap nhan hom nay va tuong lai', () => {
    expect(() => assertCheckInKhongThuocQuaKhu(homNayIso())).not.toThrow();
    expect(() => assertCheckInKhongThuocQuaKhu(ngayTuHomNay(1))).not.toThrow();
    expect(() => assertCheckInKhongThuocQuaKhu(ngayTuHomNay(365))).not.toThrow();
  });

  it('homNayIso tra ve dung dinh dang YYYY-MM-DD', () => {
    expect(homNayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isIsoDateString(homNayIso())).toBe(true);
  });
});
