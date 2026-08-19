/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Sinh access token HS256 giong dinh dang cua Supabase Auth, de thu API bang
 * curl ma khong phai dang nhap that.
 *
 * CHI dung cho dev/test cuc bo: no ky bang chinh SUPABASE_JWT_SECRET trong .env.
 * Tren moi truong that, token luon do Supabase Auth phat hanh.
 *
 *   node scripts/make-token.js                 -> user moi, role customer
 *   node scripts/make-token.js <user-id>       -> dung lai user id cu
 */
require('dotenv').config({ path: ['.env', '../../.env'] });
const { sign } = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error('Thieu SUPABASE_JWT_SECRET trong .env');
  process.exit(1);
}

const userId = process.argv[2] || randomUUID();
const email = process.argv[3] || `dev-${userId.slice(0, 8)}@example.com`;

const token = sign({ sub: userId, email, role: 'authenticated' }, secret, {
  algorithm: 'HS256',
  audience: 'authenticated',
  expiresIn: '2h',
});

console.log(JSON.stringify({ userId, email, token }, null, 2));
