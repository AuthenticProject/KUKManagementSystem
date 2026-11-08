/**
 * PHASE 1C.2 — MASTER TEST RUNNER
 * KUK Management System v3.1.0
 * 
 * Runs all Phase 1 validation and simulation suites:
 * 1. test:phase1:static      (Enhanced SQL Static Validator)
 * 2. test:phase1:simulation  (PostgreSQL RLS & Atomic RPC Simulation Engine)
 * 3. test:phase1:contracts   (Frontend & Backend Contract Verifier)
 * 4. test:phase1:fpt         (False-Positive & Mutation Testing)
 * 
 * Mode: Local-Only (Zero Remote Connection)
 */

const { runStaticValidation } = require('./test_phase1_static.cjs');
const { runSimulationSuite } = require('./test_phase1_simulation.cjs');
const { runContractValidation } = require('./test_phase1_contracts.cjs');
const { runNegativeFptSuite } = require('./test_phase1_negative_fpt.cjs');

console.log('================================================================');
console.log('PHASE 1C.2 — CONSOLIDATED VERIFICATION & SIMULATION SUITE');
console.log('================================================================\n');

const suiteResults = [];

// 1. Static Validation
console.log('>>> [SUITE 1/4] Running Static Validation Suite...');
const resStatic = runStaticValidation(undefined, false);
suiteResults.push({ name: 'Enhanced SQL Static Validation', ...resStatic });

// 2. Simulation Engine
console.log('\n>>> [SUITE 2/4] Running Simulation Engine & Adversarial Tests...');
const resSim = runSimulationSuite(false);
suiteResults.push({ name: 'RLS & Atomic RPC Simulation', ...resSim });

// 3. Contract Verifier
console.log('\n>>> [SUITE 3/4] Running Frontend & Backend Contract Verification...');
const resContracts = runContractValidation(false);
suiteResults.push({ name: 'Frontend Contract Verifier', ...resContracts });

// 4. False-Positive Mutation Testing
console.log('\n>>> [SUITE 4/4] Running False-Positive & Mutation Harness...');
const resFpt = runNegativeFptSuite(false);
suiteResults.push({ name: 'False-Positive Mutation Tests', ...resFpt });

// Summary
console.log('\n================================================================');
console.log('PHASE 1C.2 — CONSOLIDATED TEST SUMMARY');
console.log('================================================================\n');

let totalPass = 0;
let totalFail = 0;

suiteResults.forEach((s, idx) => {
  totalPass += s.passCount;
  totalFail += s.failCount;
  const statusStr = s.success ? 'PASSED' : 'FAILED';
  console.log(`[SUITE ${idx + 1}] ${s.name.padEnd(35)} : ${statusStr.padEnd(8)} (${s.passCount} passed, ${s.failCount} failed)`);
});

console.log('----------------------------------------------------------------');
console.log(`TOTAL ASSERTIONS: ${totalPass + totalFail} | PASSED: ${totalPass} | FAILED: ${totalFail}`);
console.log('----------------------------------------------------------------');

if (totalFail > 0) {
  console.error('\nOVERALL RESULT: FAILED (One or more suites failed)');
  process.exit(1);
} else {
  console.log('\nOVERALL RESULT: ALL PHASE 1C.2 LOCAL TEST SUITES PASSED');
  process.exit(0);
}

