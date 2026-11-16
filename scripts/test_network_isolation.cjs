const { chromium } = require('playwright-core');

async function testNetwork() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  const requests = [];
  page.on('request', req => {
    requests.push({ url: req.url(), method: req.method() });
  });

  console.log('Navigating to http://localhost:3000/login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  console.log('Clicking Manager La Tansa (UAT)...');
  await page.locator('button:has-text("Manager La Tansa (UAT)")').click();
  await page.waitForTimeout(1000);

  console.log('Navigating to /employees...');
  await page.goto('http://localhost:3000/employees', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await browser.close();

  const supabaseReqs = requests.filter(r => r.url.includes('supabase.co'));
  console.log(`\nTotal requests: ${requests.length}`);
  console.log(`Supabase requests: ${supabaseReqs.length}`);
  supabaseReqs.forEach(r => console.log(`  [${r.method}] ${r.url}`));
}

testNetwork().catch(console.error);
