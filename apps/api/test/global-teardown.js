/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Dung Postgres nhung tien trinh nen sau khi test xong.
 *
 * Thu muc du lieu KHONG bi xoa o day (xem `persistent: true` trong global-setup):
 * global-setup xoa no o dau moi lan chay. Doi lai, viec quan trong nhat con lai
 * la tat cho bang duoc tien trinh postgres — con sot lai thi lan chay sau se
 * dung phai cong da bi chiem.
 */
module.exports = async function globalTeardown() {
  const postgres = globalThis.__EMBEDDED_POSTGRES__;
  if (!postgres) {
    return;
  }

  try {
    await postgres.stop();
  } catch (error) {
    // Khong ném tiep: Jest se doi loi don dep thanh exit 1 du toan bo test xanh.
    // Nhung phai bao that to, vi mot postgres con song se lam lan chay sau hong.
    console.warn(
      `Canh bao: khong tat duoc Postgres tam (${error.message}). ` +
        'Kiem tra tien trinh postgres con sot lai truoc khi chay test lan sau.',
    );
  }
};
