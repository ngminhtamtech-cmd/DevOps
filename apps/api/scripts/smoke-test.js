/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Smoke test: goi API dang chay bang HTTP that (khong qua Supertest) de xac minh
 * gate giai doan 1 — "goi duoc endpoint that".
 *
 * Yeu cau: Postgres cuc bo dang chay, da migrate + seed, va API dang lang nghe.
 *   npm run db:local      (terminal 1)
 *   npm run db:migrate && npm run db:seed && npm run build && npm start   (terminal 2)
 *   node scripts/smoke-test.js   (terminal 3)
 */
require('dotenv').config({ path: ['.env', '../../.env'] });
const { sign } = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001/api';
const secret = process.env.SUPABASE_JWT_SECRET;

let passed = 0;
let failed = 0;

/** Ngay ISO cach hom nay `soNgay` ngay, tinh theo UTC. */
function ngayTuHomNay(soNgay) {
  const ngay = new Date();
  ngay.setUTCDate(ngay.getUTCDate() + soNgay);
  return ngay.toISOString().slice(0, 10);
}

function devToken(userId) {
  return sign({ sub: userId, email: `smoke-${userId.slice(0, 8)}@example.com` }, secret, {
    algorithm: 'HS256',
    audience: 'authenticated',
    expiresIn: '10m',
  });
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (nhan ${actual}, mong doi ${expected})`);
  ok ? passed++ : failed++;
}

async function main() {
  const customerId = randomUUID();
  const customerToken = devToken(customerId);

  const health = await call('GET', '/health');
  check('GET /health', health.status, 200);
  check('  health.database = up', health.body?.database, 'up');

  const hotels = await call('GET', '/hotels');
  check('GET /hotels (cong khai)', hotels.status, 200);
  const hotelId = hotels.body?.[0]?.id;
  console.log(`      hotelId = ${hotelId}`);

  const noAuth = await call('GET', '/bookings/me');
  check('GET /bookings/me khong token -> 401', noAuth.status, 401);

  const me = await call('GET', '/auth/me', { token: customerToken });
  check('GET /auth/me co token -> 200', me.status, 200);
  check('  role mac dinh = customer', me.body?.role, 'customer');

  const forbidden = await call('POST', '/hotels', {
    token: customerToken,
    body: { name: 'Khong duoc phep', address: '1 Duong X', city: 'Ha Noi' },
  });
  check('POST /hotels bang customer -> 403', forbidden.status, 403);

  // Ngay tuong doi: API tu choi dat phong cho ngay da qua, nen ngay viet cung
  // trong script se lam smoke test hong sau vai thang.
  const checkIn = ngayTuHomNay(200);
  const checkOut = ngayTuHomNay(203);
  const availability = await call(
    'GET',
    `/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`,
  );
  check('GET /availability -> 200', availability.status, 200);
  console.log(`      so phong trong = ${availability.body?.length}`);
  const roomId = availability.body?.[0]?.id;
  console.log(`      roomId = ${roomId}, tong tien = ${availability.body?.[0]?.totalPriceCents}`);

  const badRange = await call('GET', `/availability?checkIn=${checkOut}&checkOut=${checkIn}`);
  check('GET /availability ngay dao nguoc -> 400', badRange.status, 400);

  const bookingBody = {
    roomId,
    checkIn,
    checkOut,
    guestName: 'Smoke Test',
    guestEmail: 'smoke@example.com',
  };

  const created = await call('POST', '/bookings', { token: customerToken, body: bookingBody });
  check('POST /bookings -> 201', created.status, 201);
  console.log(
    `      bookingId = ${created.body?.id}, nights = ${created.body?.nights}, total = ${created.body?.totalPriceCents}`,
  );

  const duplicate = await call('POST', '/bookings', {
    token: devToken(randomUUID()),
    body: bookingBody,
  });
  check('POST /bookings trung ngay (khach khac) -> 409', duplicate.status, 409);

  const afterBooking = await call(
    'GET',
    `/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`,
  );
  const stillListed = afterBooking.body?.some((room) => room.id === roomId);
  check('phong da dat khong con trong ket qua tim kiem', stillListed, false);

  const adjacent = await call('POST', '/bookings', {
    token: devToken(randomUUID()),
    body: { ...bookingBody, checkIn: checkOut, checkOut: ngayTuHomNay(206) },
  });
  check('POST /bookings nhan phong dung ngay tra phong -> 201', adjacent.status, 201);

  const mine = await call('GET', '/bookings/me', { token: customerToken });
  check('GET /bookings/me -> 200', mine.status, 200);
  check('  chi thay booking cua chinh minh', mine.body?.length, 1);

  const cancelled = await call('POST', `/bookings/${created.body?.id}/cancel`, {
    token: customerToken,
  });
  check('POST /bookings/:id/cancel -> 200', cancelled.status, 200);
  check('  status = cancelled', cancelled.body?.status, 'cancelled');

  const reBooked = await call('POST', '/bookings', {
    token: devToken(randomUUID()),
    body: bookingBody,
  });
  check('dat lai dung khoang ngay sau khi huy -> 201', reBooked.status, 201);

  console.log(`\nKet qua: ${passed} pass, ${failed} fail`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`Smoke test loi: ${error.message}`);
  process.exit(1);
});
