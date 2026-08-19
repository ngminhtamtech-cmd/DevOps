import { config as loadDotenv } from 'dotenv';
import { seedDevData } from '../seed/dev-seed';

loadDotenv({ path: ['.env', '../../.env'] });

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Thieu DATABASE_URL. Copy .env.example thanh .env va dien gia tri.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Khong chay seed tren production.');
  }

  const result = await seedDevData({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true',
    adminUserId: process.env.SEED_ADMIN_USER_ID,
    adminEmail: process.env.SEED_ADMIN_EMAIL,
    log: (message) => console.log(message),
  });

  console.log(`hotelId = ${result.hotelId}`);
  console.log(`roomIds = ${result.roomIds.join(', ')}`);
}

main().catch((error: Error) => {
  console.error(`Seed that bai: ${error.message}`);
  process.exit(1);
});
