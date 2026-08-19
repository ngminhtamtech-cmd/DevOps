import { BadRequestException } from '@nestjs/common';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kiem tra chuoi dung dinh dang `YYYY-MM-DD` VA la ngay co that.
 *
 * Chi kiem regex thi '2026-02-30' van lot. Chi dung `new Date()` thi
 * '2026-2-3' hay '2026-02-30T00:00:00Z' cung lot va sau do lech mui gio.
 * Ket hop ca hai moi chac.
 */
export function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  // Postgres se tu chuan hoa, nhung '2026-02-30' bi Date doi thanh '2026-03-02'.
  // So sanh nguoc lai de bat truong hop do.
  return parsed.toISOString().slice(0, 10) === value;
}

@ValidatorConstraint({ name: 'isIsoDate', async: false })
class IsIsoDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isIsoDateString(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} phai la ngay hop le theo dinh dang YYYY-MM-DD`;
  }
}

export function IsIsoDate(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsIsoDateConstraint,
    });
  };
}

/** So dem giua hai ngay ISO. Dung UTC nen khong bi anh huong boi mui gio may chu. */
export function countNights(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export const MAX_STAY_NIGHTS = 30;

/** Hom nay theo UTC, dang `YYYY-MM-DD`. */
export function homNayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Chan dat phong cho ngay da qua.
 *
 * Chi ap dung luc TAO booking, khong ap dung cho truy van tim phong trong: xem
 * lai gia va tinh trang cua mot khoang ngay trong qua khu la viec hop le.
 *
 * Moc so sanh la ngay UTC. Khach o UTC+7 dat luc 00:30 ngay D se duoc chap nhan
 * du UTC con dang o ngay D-1 — le ve phia de dai, dung huong voi mot he thong
 * dat phong (tu choi nham mot don hop le te hon la nhan mot don le mot ngay).
 */
export function assertCheckInKhongThuocQuaKhu(checkIn: string): void {
  if (checkIn < homNayIso()) {
    throw new BadRequestException('Khong the dat phong cho ngay da qua');
  }
}

/**
 * Rang buoc nghiep vu chung cho moi endpoint co khoang ngay.
 * Database cung co check constraint tuong ung; kiem o day de tra loi 400 ro nghia
 * thay vi de request di den tan tang DB roi nhan loi kho hieu.
 */
export function assertValidStayRange(checkIn: string, checkOut: string): number {
  const nights = countNights(checkIn, checkOut);
  if (nights <= 0) {
    throw new BadRequestException('checkOut phai sau checkIn it nhat mot dem');
  }
  if (nights > MAX_STAY_NIGHTS) {
    throw new BadRequestException(`Moi lan dat toi da ${MAX_STAY_NIGHTS} dem`);
  }
  return nights;
}
