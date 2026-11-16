/**
 * KUK MANAGEMENT SYSTEM v3.1.0 — OFFICIAL BRANDING SCREENSHOT CAPTURE SUITE
 * 
 * Captures comprehensive high-fidelity Desktop (1366x768) and Mobile (390x844)
 * visual evidence across all 12 modules, 3 public kiosks, and unit switching.
 * Stored in: docs/screenshots/rebranding/
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots', 'rebranding');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

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
  console.error('Edge browser executable not found on host!');
  process.exit(1);
}

const MODULES = [
  { name: 'landing', path: '/', title: 'Landing Page' },
  { name: 'login', path: '/login', title: 'Portal Login Gateway' },
  { name: 'dashboard', path: '/dashboard', title: 'Dashboard Eksekutif' },
  { name: 'employees', path: '/employees', title: 'Master Data Karyawan' },
  { name: 'attendance', path: '/attendance', title: 'Presensi & Briefing Operasional' },
  { name: 'leave', path: '/leave', title: 'Manajemen Cuti Karyawan' },
  { name: 'glass-tips', path: '/glass-tips', title: 'Tip Pemotongan Kaca' },
  { name: 'fleet', path: '/fleet', title: 'Armada & Peminjaman Kendaraan' },
  { name: 'violations', path: '/violations', title: 'Pelanggaran & Surat Peringatan' },
  { name: 'payroll', path: '/payroll', title: 'Penggajian & Slip Gaji' },
  { name: 'finance', path: '/finance', title: 'Kas & Pengeluaran Toko' },
  { name: 'audit', path: '/audit', title: 'Audit Trail & Jejak Mutasi Data' },
  { name: 'settings', path: '/settings', title: 'Pengaturan Sistem & RBAC' },
  { name: 'kiosk-glass', path: '/kiosk/glass-tip', title: 'Kiosk Tip Pemotongan Kaca' },
  { name: 'kiosk-fleet', path: '/kiosk/fleet-booking', title: 'Kiosk Peminjaman Armada' },
  { name: 'kiosk-leave', path: '/kiosk/leave-request', title: 'Kiosk Permohonan Cuti' },
];

async function captureAll() {
  console.log('='.repeat(70));
  console.log('KUK MANAGEMENT SYSTEM v3.1.0 — OFFICIAL REBRANDING VISUAL CAPTURE');
  console.log(`Target: ${BASE_URL} | Browser: Microsoft Edge`);
  console.log(`Output Directory: ${OUT_DIR}`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // 1. DESKTOP VIEWPORT (1366x768)
    console.log('\n--- CAPTURING DESKTOP VIEWPORT (1366x768) ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
    });
    const desktopPage = await desktopContext.newPage();

    // Authenticate as Pimpinan (Super Admin) for full module access
    await desktopPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const pimpinanBtn = desktopPage.locator('button:has-text("Pimpinan")').first();
    await pimpinanBtn.waitFor({ state: 'visible', timeout: 10000 });
    await pimpinanBtn.click();
    await desktopPage.waitForURL('**/dashboard', { timeout: 10000 });
    await desktopPage.waitForTimeout(600);

    for (const mod of MODULES) {
      console.log(`[DESKTOP] Capturing: ${mod.title} (${mod.path})`);
      await desktopPage.goto(`${BASE_URL}${mod.path}`, { waitUntil: 'networkidle' });
      await desktopPage.waitForTimeout(800);
      const outPath = path.join(OUT_DIR, `${mod.name}-desktop.png`);
      await desktopPage.screenshot({ path: outPath, fullPage: false });
      console.log(`  -> Saved: ${path.basename(outPath)}`);
    }

    // Switch unit to KUK Palen and capture dashboard with KUK Palen Branding
    console.log('\n[DESKTOP] Capturing Unit Switch to KUK Palen...');
    await desktopPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    const unitSelector = desktopPage.locator('button:has-text("TB KUK La Tansa"), button:has-text("KUK Palen"), button:has-text("Semua Unit")').first();
    if (await unitSelector.isVisible()) {
      await unitSelector.click();
      await desktopPage.waitForTimeout(300);
      const palenOption = desktopPage.locator('button:has-text("KUK Palen")').first();
      if (await palenOption.isVisible()) {
        await palenOption.click();
        await desktopPage.waitForTimeout(800);
        const palenPath = path.join(OUT_DIR, 'dashboard-palen-desktop.png');
        await desktopPage.screenshot({ path: palenPath, fullPage: false });
        console.log(`  -> Saved KUK Palen Dashboard: ${path.basename(palenPath)}`);
      }
    }

    await desktopContext.close();

    // 2. MOBILE VIEWPORT (390x844 - iPhone 14/15)
    console.log('\n--- CAPTURING MOBILE VIEWPORT (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const mobilePage = await mobileContext.newPage();

    // Authenticate as Pimpinan on mobile
    await mobilePage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const mobPimpinanBtn = mobilePage.locator('button:has-text("Pimpinan")').first();
    await mobPimpinanBtn.waitFor({ state: 'visible', timeout: 10000 });
    await mobPimpinanBtn.click();
    await mobilePage.waitForURL('**/dashboard', { timeout: 10000 });
    await mobilePage.waitForTimeout(600);

    for (const mod of MODULES) {
      console.log(`[MOBILE] Capturing: ${mod.title} (${mod.path})`);
      await mobilePage.goto(`${BASE_URL}${mod.path}`, { waitUntil: 'networkidle' });
      await mobilePage.waitForTimeout(800);
      const outPath = path.join(OUT_DIR, `${mod.name}-mobile.png`);
      await mobilePage.screenshot({ path: outPath, fullPage: false });
      console.log(`  -> Saved: ${path.basename(outPath)}`);
    }

    await mobileContext.close();

    console.log('\n================================================================');
    console.log('ALL REBRANDING SCREENSHOTS SUCCESSFULLY CAPTURED!');
    console.log(`Total images generated in: ${OUT_DIR}`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureAll();
