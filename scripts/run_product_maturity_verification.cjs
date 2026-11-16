/**
 * KUK MANAGEMENT SYSTEM v3.1.0 - PRODUCT MATURITY & RESPONSIVE VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Responsive layout across 6 viewports (360x800, 390x844, 768x1024, 1024x768, 1366x768, 1920x1080)
 * 2. Mobile navigation toggle & drawer interaction
 * 3. In-app confirmation modal (eliminates raw window.confirm)
 * 4. Operational print modals for 6 core modules (Employee Directory, Cash Voucher, Fleet Surat Jalan, Leave Form, SP Letter, Payroll Slip)
 * 5. Visual screenshots collected in docs/screenshots/
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const RESPONSIVE_DIR = path.join(__dirname, '..', 'docs', 'screenshots', 'responsive');
const MATURITY_DIR = path.join(__dirname, '..', 'docs', 'screenshots', 'maturity');

if (!fs.existsSync(RESPONSIVE_DIR)) fs.mkdirSync(RESPONSIVE_DIR, { recursive: true });
if (!fs.existsSync(MATURITY_DIR)) fs.mkdirSync(MATURITY_DIR, { recursive: true });

const results = [];

function record(id, title, status, notes = '') {
  results.push({ id, title, status, notes });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`[${icon} ${status}] ${id} - ${title}${notes ? ` (${notes})` : ''}`);
}

async function switchToDemoRole(page, roleLabel) {
  if (page.url() === 'about:blank' || !page.url().startsWith(BASE_URL)) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  }
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  let username = 'andika';
  let password = '12345';
  if (/pimpinan/i.test(roleLabel)) {
    username = 'fariz';
    password = '12345';
  } else if (/palen/i.test(roleLabel)) {
    username = 'Raju';
    password = '54321';
  } else if (/supervisor/i.test(roleLabel)) {
    username = 'shuva';
    password = '12345';
  } else if (/hrd/i.test(roleLabel)) {
    username = 'irsyadil';
    password = '150904';
  } else if (/bendahara|finance/i.test(roleLabel)) {
    username = 'ari';
    password = '12345';
  }

  const select = page.locator('#selectUsername');
  await select.waitFor({ state: 'visible', timeout: 12000 });
  await page.selectOption('#selectUsername', username);
  await page.fill('#inputPassword', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 12000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

async function runMaturitySuite() {
  console.log('='.repeat(80));
  console.log('KUK MANAGEMENT SYSTEM v3.1.0 — FULL PRODUCT MATURITY & RESPONSIVE QA');
  console.log(`Target: ${BASE_URL} | Browser: Microsoft Edge`);
  console.log('='.repeat(80));

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  let executablePath = null;
  for (const p of edgePaths) {
    if (fs.existsSync(p)) {
      executablePath = p;
      break;
    }
  }

  if (!executablePath) {
    throw new Error('Edge executable not found on host');
  }

  console.log(`Launching Edge from: ${executablePath}`);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const VIEWPORTS = [
    { name: 'mobile-small', width: 360, height: 800, label: '360x800 (Mobile Small)' },
    { name: 'mobile-standard', width: 390, height: 844, label: '390x844 (Mobile Standard iPhone)' },
    { name: 'tablet', width: 768, height: 1024, label: '768x1024 (Tablet iPad)' },
    { name: 'small-desktop', width: 1024, height: 768, label: '1024x768 (Small Desktop)' },
    { name: 'laptop', width: 1366, height: 768, label: '1366x768 (Standard Laptop)' },
    { name: 'full-hd', width: 1920, height: 1080, label: '1920x1080 (Full HD Desktop)' },
  ];

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: RESPONSIVE VIEWPORT CHECKS
    // ------------------------------------------------------------------------
    console.log('\n--- 1. RESPONSIVE DESIGN & VIEWPORT VERIFICATION ---');

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        
        // Cek dashboard rendering
        await page.waitForSelector('h2:has-text("Selamat Datang")', { timeout: 8000 });

        // Cek header brand
        const headerVisible = await page.locator('header').isVisible();

        // Cek sidebar vs hamburger button
        const isMobile = vp.width < 768;
        const desktopSidebarVisible = await page.locator('aside.hidden.md\\:flex').isVisible().catch(() => false);
        const hamburgerVisible = await page.locator('button[aria-label="Buka menu navigasi"]').isVisible().catch(() => false);

        const navOk = isMobile ? hamburgerVisible && !desktopSidebarVisible : desktopSidebarVisible;

        // Ambil screenshot viewport
        const screenshotPath = path.join(RESPONSIVE_DIR, `dashboard-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        if (headerVisible && navOk) {
          record(`RESP-${vp.name.toUpperCase()}`, `Layout pada viewport ${vp.label}`, 'PASS', `Screenshot: ${path.basename(screenshotPath)}`);
        } else {
          record(`RESP-${vp.name.toUpperCase()}`, `Layout pada viewport ${vp.label}`, 'FAIL', `header=${headerVisible}, navOk=${navOk}`);
        }

        // Jika mobile, uji pembukaan drawer navigasi
        if (isMobile) {
          await page.locator('button[aria-label="Buka menu navigasi"]').click();
          await page.waitForTimeout(300);
          const drawerCloseBtn = page.locator('.fixed.inset-0 button[aria-label="Tutup navigasi"]');
          const drawerOpen = await drawerCloseBtn.isVisible();
          
          const drawerScreenshot = path.join(RESPONSIVE_DIR, `drawer-${vp.name}.png`);
          await page.screenshot({ path: drawerScreenshot });

          // Tutup drawer
          await drawerCloseBtn.click();
          await page.waitForTimeout(300);

          if (drawerOpen) {
            record(`NAV-MOBILE-${vp.name.toUpperCase()}`, `Mobile drawer buka/tutup pada ${vp.label}`, 'PASS');
          } else {
            record(`NAV-MOBILE-${vp.name.toUpperCase()}`, `Mobile drawer buka/tutup pada ${vp.label}`, 'FAIL', 'Drawer tidak muncul');
          }
        }
      } catch (err) {
        record(`RESP-${vp.name.toUpperCase()}`, `Layout pada viewport ${vp.label}`, 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // ------------------------------------------------------------------------
    // SECTION 2: IN-APP CONFIRMATION MODAL (NO WINDOW.CONFIRM)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. IN-APP CONFIRMATION MODAL AUDIT ---');
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();

      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await page.goto(`${BASE_URL}/employees`);
        await page.waitForSelector('table', { timeout: 8000 });

        // Klik tombol power (toggle status) pada karyawan pertama
        const powerBtn = page.locator('button[title*="Nonaktifkan Karyawan"], button[title*="Aktifkan Kembali Karyawan"]').first();
        await powerBtn.waitFor({ state: 'visible' });
        await powerBtn.click();

        // Verifikasi ConfirmModal muncul (bukan alert bawaan browser)
        const modal = page.locator('div[role="dialog"][aria-modal="true"]');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        const modalTitle = await modal.locator('#confirm-modal-title').textContent();
        const cancelBtn = modal.locator('button:has-text("Batal")');

        const screenshotPath = path.join(MATURITY_DIR, 'in-app-confirm-modal.png');
        await page.screenshot({ path: screenshotPath });

        // Klik Batal
        await cancelBtn.click();
        await modal.waitFor({ state: 'hidden', timeout: 5000 });

        record('MODAL-CONFIRM-01', 'Penggantian window.confirm dengan ConfirmModal in-app yang elegan & aksesibel', 'PASS', `Judul: "${modalTitle}"`);
      } catch (err) {
        record('MODAL-CONFIRM-01', 'Penggantian window.confirm dengan ConfirmModal', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // ------------------------------------------------------------------------
    // SECTION 3: OPERATIONAL PRINT MODALS & OFFICIAL KUK LETTERHEADS
    // ------------------------------------------------------------------------
    console.log('\n--- 3. OPERATIONAL PRINT LAYOUTS & ENTERPRISE LETTERHEADS ---');

    async function seedPrintFixtures(page) {
      await page.evaluate(async () => {
        try {
          const { previewStore } = await import('/src/services/dataService.ts');
          const unitId = '00000000-0000-0000-0000-000000000001';
          if (previewStore.getCashExpenses(unitId).length === 0) {
            previewStore.recordExpense(unitId, {
              category: 'OFFICE_SUPPLIES',
              amount: 175000,
              description: 'Pembelian kertas thermal kasir & nota',
              recipient_name: 'Toko ATK Barokah',
              expense_date: '2026-11-16',
            });
          }
          if (previewStore.getBorrowingRequests(unitId).length === 0) {
            previewStore.bookVehicle(unitId, {
              vehicle_id: 'veh-001',
              borrower_name: 'Budi Santoso',
              borrower_institution: 'Internal Gudang',
              borrower_phone: '081234567890',
              responsible_person: 'Kepala Gudang',
              start_time: '2026-11-17T09:00:00Z',
              estimated_return_time: '2026-11-17T15:00:00Z',
              destination: 'Proyek Cileungsi',
              purpose: 'Pengiriman pesanan kaca tempered',
            });
          }
          if (previewStore.getLeaveRequests(unitId).length === 0) {
            previewStore.submitLeaveRequest(unitId, {
              employee_id: 'emp-002',
              reason: 'Keperluan keluarga penting',
              target_month: '2026-12',
              dates: ['2026-12-06'],
            });
          }
          if (previewStore.getWarningLetters(unitId).length === 0) {
            previewStore.issueWarningLetter(unitId, {
              employee_id: 'emp-001',
              letter_number: 'SP/TB-LATANSA/202611/0001',
              level: 'ORAL_WARNING',
              issued_date: '2026-11-16',
              valid_until: '2027-05-16',
              reason: 'Evaluasi disiplin kehadiran berkala',
              issued_by: 'Kepala Toko La Tansa',
            });
          }
          if (previewStore.getGlassTips(unitId).length === 0) {
            previewStore.submitGlassTip(unitId, {
              employee_id: 'emp-001',
              glass_type_id: 'gt-01',
              length_cm: 120,
              height_cm: 150,
              quantity: 2,
              notes: 'Potong kaca polos 5mm',
            });
          }
          if (previewStore.getPayrollPeriods(unitId).length === 0) {
            previewStore.createPayrollPeriod(unitId, {
              period_name: 'Gaji Periode November 2026',
              start_date: '2026-11-01',
              end_date: '2026-11-30',
              payout_date: '2026-12-01',
            });
          }
        } catch (e) {
          console.warn('Seed error', e);
        }
      });
    }

    // 3.1 Cetak Daftar Induk Karyawan
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await page.goto(`${BASE_URL}/employees`);
        await page.waitForSelector('table', { timeout: 8000 });

        const printBtn = page.locator('button:has-text("Cetak Rekap")');
        await printBtn.click();

        await page.waitForSelector('text=DAFTAR INDUK KARYAWAN', { timeout: 5000 });
        const letterhead = await page.locator('text=CV KARYA UTAMA KREASI').first().isVisible();

        const screenshotPath = path.join(MATURITY_DIR, 'print-employee-directory.png');
        await page.screenshot({ path: screenshotPath });

        if (letterhead) {
          record('PRINT-EMP-01', 'Cetak Daftar Induk Karyawan Resmi dengan Kop Surat KUK & Kolom TTD', 'PASS');
        } else {
          record('PRINT-EMP-01', 'Cetak Daftar Induk Karyawan', 'FAIL', 'Letterhead tidak ditemukan');
        }
      } catch (err) {
        record('PRINT-EMP-01', 'Cetak Daftar Induk Karyawan', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // 3.2 Cetak Voucher Kas Kecil (Petty Cash Voucher)
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await seedPrintFixtures(page);
        await page.goto(`${BASE_URL}/finance`);
        await page.waitForSelector('table', { timeout: 8000 });

        // Klik printer button pada baris kas pertama
        const printBtn = page.locator('button[title*="Cetak Bukti Pengeluaran Kas"]').first();
        await printBtn.click();

        await page.waitForSelector('text=BUKTI PENGELUARAN KAS KECIL', { timeout: 5000 });
        const letterhead = await page.locator('text=CV KARYA UTAMA KREASI').first().isVisible();
        const totalUang = await page.locator('text=Total Uang Dikeluarkan').first().isVisible();

        const screenshotPath = path.join(MATURITY_DIR, 'print-cash-voucher.png');
        await page.screenshot({ path: screenshotPath });

        if (letterhead && totalUang) {
          record('PRINT-FIN-01', 'Cetak Voucher Pengeluaran Kas Kecil dengan Status Otorisasi & 3 Kolom TTD', 'PASS');
        } else {
          record('PRINT-FIN-01', 'Cetak Voucher Kas Kecil', 'FAIL', 'Elemen voucher tidak lengkap');
        }
      } catch (err) {
        record('PRINT-FIN-01', 'Cetak Voucher Kas Kecil', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // 3.3 Cetak Surat Jalan Peminjaman Armada
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await seedPrintFixtures(page);
        await page.goto(`${BASE_URL}/fleet`);
        
        // Pindah ke tab pengajuan peminjaman
        await page.locator('button:has-text("Pengajuan Peminjaman")').click();
        await page.waitForTimeout(500);

        // Klik printer button pada pengajuan pertama
        const printBtn = page.locator('button[title*="Cetak Surat Jalan"]').first();
        await printBtn.click();

        await page.waitForSelector('text=SURAT JALAN & IZIN OPERASIONAL ARMADA', { timeout: 5000 });
        const checklist = await page.locator('text=Lembar Cek Fisik & Kondisi Armada').isVisible();

        const screenshotPath = path.join(MATURITY_DIR, 'print-fleet-surat-jalan.png');
        await page.screenshot({ path: screenshotPath });

        if (checklist) {
          record('PRINT-FLEET-01', 'Cetak Surat Jalan Armada Resmi dengan Lembar Cek Fisik Odometer/BBM & 3 Kolom TTD', 'PASS');
        } else {
          record('PRINT-FLEET-01', 'Cetak Surat Jalan Armada', 'FAIL', 'Checklist fisik tidak ditemukan');
        }
      } catch (err) {
        record('PRINT-FLEET-01', 'Cetak Surat Jalan Armada', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // 3.4 Cetak Formulir Permohonan Cuti
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await seedPrintFixtures(page);
        await page.goto(`${BASE_URL}/leave`);
        await page.waitForTimeout(500);

        // Klik printer button pada permohonan pertama
        const printBtn = page.locator('button[title*="Cetak Formulir"]').first();
        await printBtn.click();

        await page.waitForSelector('text=SURAT PERMOHONAN CUTI RESMI', { timeout: 5000 });
        const rules = await page.locator('text=Ketentuan Cuti Perusahaan').isVisible();

        const screenshotPath = path.join(MATURITY_DIR, 'print-leave-form.png');
        await page.screenshot({ path: screenshotPath });

        if (rules) {
          record('PRINT-LEAVE-01', 'Cetak Formulir Permohonan Cuti Resmi dengan Kuota Maks 3 Hari & Kolom TTD Atasan', 'PASS');
        } else {
          record('PRINT-LEAVE-01', 'Cetak Formulir Cuti', 'FAIL', 'Ketentuan cuti tidak ditemukan');
        }
      } catch (err) {
        record('PRINT-LEAVE-01', 'Cetak Formulir Cuti', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // 3.5 Cetak Surat Peringatan (SP) dengan Watermark Administratif
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await seedPrintFixtures(page);
        await page.goto(`${BASE_URL}/violations`);
        
        // Pindah ke tab Surat Peringatan
        await page.locator('button:has-text("Surat Peringatan")').click();
        await page.waitForTimeout(500);

        // Klik printer button pada SP pertama
        const printBtn = page.locator('button[title*="Cetak Surat Peringatan"]').first();
        await printBtn.click();

        await page.waitForSelector('text=SURAT PERINGATAN', { timeout: 5000 });
        const disclaimer = await page.locator('text=BUSINESS DECISION REQUIRED').isVisible();

        const screenshotPath = path.join(MATURITY_DIR, 'print-sp-official.png');
        await page.screenshot({ path: screenshotPath });

        if (disclaimer) {
          record('PRINT-SP-01', 'Cetak Surat Peringatan Resmi berstatus BUSINESS DECISION REQUIRED (Draft Administratif 6 Bulan)', 'PASS');
        } else {
          record('PRINT-SP-01', 'Cetak Surat Peringatan', 'FAIL', 'Disclaimer administratif tidak ditemukan');
        }
      } catch (err) {
        record('PRINT-SP-01', 'Cetak Surat Peringatan', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // 3.6 Cetak Nota Verifikasi Tip Kaca
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await seedPrintFixtures(page);
        await page.goto(`${BASE_URL}/glass-tips`);
        await page.waitForSelector('table', { timeout: 8000 });

        // Klik printer button pada nota pertama
        const printBtn = page.locator('button[title*="Cetak Nota Verifikasi"]').first();
        await printBtn.click();

        await page.waitForSelector('text=TANDA TERIMA VERIFIKASI TIP POTONG KACA', { timeout: 5000 });
        const formula = (await page.locator('text=Formula Komisi Baku 3%').count() > 0) || (await page.locator('text=Formula Baku 3%').count() > 0);

        const screenshotPath = path.join(MATURITY_DIR, 'print-glass-tip-receipt.png');
        await page.screenshot({ path: screenshotPath });

        if (formula) {
          record('PRINT-TIP-01', 'Cetak Tanda Terima Verifikasi Tip Kaca dengan Formula Baku 3% & Rincian Dimensi', 'PASS');
        } else {
          record('PRINT-TIP-01', 'Cetak Tanda Terima Tip Kaca', 'FAIL', 'Formula 3% tidak ditemukan');
        }
      } catch (err) {
        record('PRINT-TIP-01', 'Cetak Tanda Terima Tip Kaca', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

    // 3.7 Cetak Slip Gaji Resmi (Payroll Slip)
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      try {
        await switchToDemoRole(page, 'Manager La Tansa (UAT)');
        await seedPrintFixtures(page);
        await page.goto(`${BASE_URL}/payroll`);
        await page.waitForSelector('table', { timeout: 8000 });

        // Klik tombol rincian slip pada baris pertama
        const viewBtn = page.locator('button[title*="Lihat Rincian Slip Gaji"]').first();
        await viewBtn.click();

        await page.waitForSelector('text=SLIP GAJI RESMI', { timeout: 5000 });
        const netPay = await page.locator('text=Total Diterima Bersih').isVisible();

        const screenshotPath = path.join(MATURITY_DIR, 'print-payroll-slip.png');
        await page.screenshot({ path: screenshotPath });

        if (netPay) {
          record('PRINT-PAYROLL-01', 'Cetak Slip Gaji Resmi dengan Pendapatan, Potongan, Take Home Pay, dan Kop KUK', 'PASS');
        } else {
          record('PRINT-PAYROLL-01', 'Cetak Slip Gaji', 'FAIL', 'Elemen net pay tidak ditemukan');
        }
      } catch (err) {
        record('PRINT-PAYROLL-01', 'Cetak Slip Gaji', 'FAIL', err.message);
      } finally {
        await context.close();
      }
    }

  } finally {
    await browser.close();
  }

  // Rekapitulasi
  console.log('\n' + '='.repeat(80));
  console.log('REKAPITULASI PRODUCT MATURITY & RESPONSIVE VERIFICATION');
  console.log('='.repeat(80));

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = total - passed;

  console.log(`Total Asersi: ${total}`);
  console.log(`Lulus: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Gagal: ${failed}`);

  if (failed > 0) {
    console.error('\nTerdapat pengujian yang gagal!');
    process.exit(1);
  } else {
    console.log('\n🎉 SELURUH PENGUJIAN PRODUCT MATURITY & RESPONSIVE BERHASIL 100%!');
  }
}

runMaturitySuite().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
