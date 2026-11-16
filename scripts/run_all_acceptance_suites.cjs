/**
 * Master Verification & Acceptance Runner
 * Executes all automated validation suites across the KUK Management System v3.1.0
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const suites = [
  { name: 'TypeScript Static Compilation (tsc --noEmit)', cmd: 'npm run typecheck' },
  { name: '9 UAT Demo Identities & RBAC Scope', cmd: 'npm run test:identities' },
  { name: 'Phase 1 Consolidated Verification & RLS Simulation', cmd: 'npm run test:phase1:all' },
  { name: 'Phase 2 Business Logic & Calculation Formulas', cmd: 'npm run test:phase2' },
  { name: 'Phase 3 Business Bounds & Rate Limit Governance', cmd: 'npm run test:phase3' },
  { name: 'Demo Auth & Profile Context Loader', cmd: 'npm run test:demo' },
  { name: 'Operational UAT Scenarios (All Modules)', cmd: 'npm run test:uat' },
  { name: 'Real Browser UI & Navigation Flow', cmd: 'npm run test:ui' },
  { name: 'Deep Functional UI & Workflow Audit', cmd: 'npm run test:deep' },
  { name: 'Negative Testing, Anti-Tamper & Preview Store Bounds', cmd: 'npm run test:negative' },
  { name: 'Business Rules Consistency & Multi-Level Auth Audit', cmd: 'npm run test:business-auth' },
  { name: 'Product Maturity & 3% Glass Tip Business Rule', cmd: 'npm run test:maturity' },
];

console.log('='.repeat(80));
console.log('  KUK MANAGEMENT SYSTEM v3.1.0 — MASTER ACCEPTANCE TEST RUNNER');
console.log('='.repeat(80));

let allPassed = true;
const results = [];

suites.forEach((suite, idx) => {
  console.log(`\n[${idx + 1}/${suites.length}] Running: ${suite.name}...`);
  try {
    const start = Date.now();
    const output = execSync(suite.cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'pipe' });
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`  -> RESULT: PASSED (${duration}s)`);
    results.push({ name: suite.name, status: 'PASSED', duration: `${duration}s` });
  } catch (err) {
    console.error(`  -> RESULT: FAILED`);
    console.error(err.stdout || err.message);
    results.push({ name: suite.name, status: 'FAILED' });
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(80));
console.log('  CONSOLIDATED ACCEPTANCE SUMMARY REPORT');
console.log('='.repeat(80));

results.forEach((r, idx) => {
  const mark = r.status === 'PASSED' ? '[PASS]' : '[FAIL]';
  console.log(`  ${mark} ${String(idx + 1).padStart(2)}. ${r.name.padEnd(58)} [${r.status}] (${r.duration || 'N/A'})`);
});

console.log('='.repeat(80));

if (allPassed) {
  console.log('\n>>> ALL 12 ACCEPTANCE SUITES PASSED PERFECTLY WITH ZERO ERRORS <<<');
  console.log('>>> KUK MANAGEMENT SYSTEM v3.1.0 IS FULLY OPERATIONAL & READY <<<\n');
  process.exit(0);
} else {
  console.error('\n>>> SOME SUITES FAILED — PLEASE REVIEW LOGS ABOVE <<<\n');
  process.exit(1);
}
