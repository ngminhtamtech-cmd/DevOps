import { config as loadDotenv } from 'dotenv';
import { runMigrations } from '../migration-runner';

loadDotenv({ path: ['.env', '../../.env'] });

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Thieu DATABASE_URL. Copy .env.example thanh .env va dien gia tri.');
  }

  const result = await runMigrations({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true',
    log: (message) => console.log(message),
  });

  console.log(
    `Xong. Da chay ${result.applied.length} migration moi, bo qua ${result.skipped.length} migration da co.`,
  );
}

main().catch((error: Error) => {
  console.error(`Migration that bai: ${error.message}`);
  process.exit(1);
});
