// Runtime verification for all routes and SPA refresh
async function verifyAllRoutes() {
  const routes = [
    '/',
    '/login',
    '/dashboard',
    '/employees',
    '/leave',
    '/glass-tips',
    '/violations',
    '/attendance',
    '/payroll',
    '/fleet',
    '/audit-logs',
    '/settings',
    '/public/fleet-booking',
    '/public/leave-request',
    '/public/glass-tip'
  ];

  console.log('=== VERIFYING SPA ROUTE REFRESH & NAVIGATION ===');
  let successCount = 0;

  for (const r of routes) {
    try {
      const res = await fetch(`http://127.0.0.1:5173${r}`);
      const text = await res.text();
      const hasRoot = text.includes('id="root"');
      const hasMainScript = text.includes('/src/main.tsx');
      if (res.status === 200 && hasRoot && hasMainScript) {
        console.log(`✓ [200 OK] Refresh route ${r.padEnd(25)} -> Valid SPA Shell`);
        successCount++;
      } else {
        console.error(`✗ [FAIL] Route ${r}: Status ${res.status}`);
      }
    } catch (e) {
      console.error(`✗ [ERROR] Route ${r}: ${e.message}`);
    }
  }

  console.log(`\nResult: ${successCount}/${routes.length} routes return valid 200 SPA shell upon refresh.`);
}

verifyAllRoutes();
