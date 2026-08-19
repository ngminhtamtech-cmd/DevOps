/**
 * Dung Postgres nhung tien trinh nen sau khi test xong. `persistent: false`
 * khien thu muc du lieu bi xoa theo, nen moi lan chay test deu bat dau sach.
 */
module.exports = async function globalTeardown() {
  const postgres = globalThis.__EMBEDDED_POSTGRES__;
  if (postgres) {
    await postgres.stop();
  }
};
