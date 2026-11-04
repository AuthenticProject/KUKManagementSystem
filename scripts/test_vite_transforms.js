// Script to test Vite module transformations
const modules = [
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/routes.tsx',
  '/src/contexts/AuthContext.tsx',
  '/src/contexts/UnitContext.tsx',
  '/src/components/guards/AuthGuard.tsx',
  '/src/components/guards/PermissionGuard.tsx',
  '/src/components/feedback/ErrorBoundary.tsx',
  '/src/components/layout/AppShell.tsx',
  '/src/components/layout/Header.tsx',
  '/src/components/layout/Sidebar.tsx',
  '/src/modules/landing/LandingPage.tsx',
  '/src/modules/auth/LoginPage.tsx',
  '/src/modules/dashboard/DashboardPage.tsx',
  '/src/services/supabase.ts'
];

async function testTransforms() {
  console.log('--- TESTING VITE DEV SERVER MODULE TRANSFORMS ---');
  let passCount = 0;
  for (const mod of modules) {
    try {
      const res = await fetch(`http://127.0.0.1:5173${mod}`);
      if (res.status === 200) {
        const text = await res.text();
        console.log(`✓ [200 OK] ${mod} (${text.length} bytes transformed)`);
        passCount++;
      } else {
        console.error(`✗ [${res.status}] ${mod}`);
      }
    } catch (err) {
      console.error(`✗ [ERROR] ${mod}: ${err.message}`);
    }
  }
  console.log(`Result: ${passCount}/${modules.length} modules successfully transformed by Vite without any errors.`);
}

testTransforms();

