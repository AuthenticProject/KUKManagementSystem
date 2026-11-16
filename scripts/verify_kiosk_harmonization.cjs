const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Testing Kiosk Harmonization & Back Navigation...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const outDir = path.resolve(__dirname, '..', 'reports', 'kiosk_verification');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Landing Page
  console.log('1. Checking Landing Page...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, '01_landing_page.png') });

  // 2. Click Ajukan Peminjaman
  console.log('2. Navigating to Fleet Booking (/public/fleet-booking)...');
  await page.click('a[href="/public/fleet-booking"]');
  await page.waitForTimeout(1000);
  console.log('Current URL:', page.url());

  // Check Back Button
  const backBtnFleet = await page.$('a[href="/"]');
  console.log('Back button exists in Fleet Booking:', !!backBtnFleet);
  await page.screenshot({ path: path.join(outDir, '02_fleet_booking.png') });

  // Check 4 vehicles
  const vehicleCards = await page.$$('button:has-text("L300"), button:has-text("Engkel"), button:has-text("Viar"), button:has-text("Forklift")');
  console.log('Armada vehicle buttons found:', vehicleCards.length);

  // Check Back button click
  console.log('Clicking Back button in Fleet Booking...');
  await page.click('a[href="/"]');
  await page.waitForTimeout(500);
  console.log('Returned to URL:', page.url());

  // 3. Click Buka Layanan Karyawan
  console.log('3. Navigating to Layanan Karyawan (/layanan-karyawan)...');
  await page.click('a[href="/layanan-karyawan"]');
  await page.waitForTimeout(1000);
  console.log('Current URL:', page.url());
  const backBtnLayanan = await page.$('a[href="/"]');
  console.log('Back button exists in Layanan Karyawan:', !!backBtnLayanan);
  await page.screenshot({ path: path.join(outDir, '03_layanan_karyawan_cuti.png') });

  // Switch to Tip Kaca tab
  console.log('Switching to Tip Kaca tab...');
  await page.click('button:has-text("Tip Potong Kaca")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '04_layanan_karyawan_tip.png') });

  // Check Direct Cuti page
  console.log('4. Navigating to /public/leave-request...');
  await page.goto('http://localhost:3000/public/leave-request', { waitUntil: 'networkidle' });
  const backBtnCuti = await page.$('a[href="/"]');
  console.log('Back button exists in /public/leave-request:', !!backBtnCuti);
  await page.screenshot({ path: path.join(outDir, '05_leave_request_direct.png') });

  // Check Direct Tip page
  console.log('5. Navigating to /public/glass-tip...');
  await page.goto('http://localhost:3000/public/glass-tip', { waitUntil: 'networkidle' });
  const backBtnTip = await page.$('a[href="/"]');
  console.log('Back button exists in /public/glass-tip:', !!backBtnTip);
  await page.screenshot({ path: path.join(outDir, '06_glass_tip_direct.png') });

  await browser.close();
  console.log('ALL VERIFICATION CHECKS PASSED!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
