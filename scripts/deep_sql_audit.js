import fs from 'fs';

const sql = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');

console.log('=== DEEP STATIC AUDIT: CANONICAL SCHEMA MIGRATION v3.1.0 ===');

// 1. Audit Enums
const enums = new Set();
for (const m of sql.matchAll(/CREATE TYPE ([a-zA-Z0-9_]+) AS ENUM/gi)) {
  enums.add(m[1]);
}
console.log(`[1] Custom ENUMs defined: ${enums.size}`);

// 2. Audit Tables
const tables = new Map();
const tableMatches = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi)];
for (const m of tableMatches) {
  const tableName = m[1];
  const body = m[2];
  // extract column names
  const cols = new Set();
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('CONSTRAINT') || trimmed.startsWith('UNIQUE') || trimmed.startsWith('CHECK') || trimmed.startsWith('--')) continue;
    const colMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+[A-Za-z0-9_]+/);
    if (colMatch) {
      cols.add(colMatch[1]);
    }
  }
  tables.set(tableName, cols);
}
console.log(`[2] Master & Transaction Tables defined: ${tables.size}`);

// 3. Audit Functions
const functions = new Set();
for (const m of sql.matchAll(/CREATE OR REPLACE FUNCTION ([a-zA-Z0-9_]+)/gi)) {
  functions.add(m[1]);
}
console.log(`[3] Stored Procedures & Functions defined: ${functions.size}`);

// 4. Audit Triggers
const triggers = [...sql.matchAll(/CREATE TRIGGER ([a-zA-Z0-9_]+)\s+[\s\S]*?EXECUTE FUNCTION ([a-zA-Z0-9_]+)\(\);/gi)];
console.log(`[4] Triggers defined: ${triggers.length}`);
for (const t of triggers) {
  const trgName = t[1];
  const fnName = t[2];
  if (!functions.has(fnName)) {
    console.error(`✗ TRIGGER ERROR: Trigger ${trgName} points to non-existent function ${fnName}`);
  } else {
    console.log(`✓ Trigger ${trgName} -> Function ${fnName} (VALID)`);
  }
}

// 5. Audit RLS Status
const rlsEnabledTables = new Set();
for (const m of sql.matchAll(/ALTER TABLE ([a-zA-Z0-9_]+) ENABLE ROW LEVEL SECURITY;/gi)) {
  rlsEnabledTables.add(m[1]);
}
console.log(`[5] Tables with ROW LEVEL SECURITY enabled: ${rlsEnabledTables.size}/${tables.size}`);
for (const t of tables.keys()) {
  if (!rlsEnabledTables.has(t)) {
    console.warn(`! Table ${t} does not have explicit ENABLE ROW LEVEL SECURITY`);
  }
}

// 6. Audit Foreign Key References
const fkErrors = [];
for (const [tbl, cols] of tables.entries()) {
  const bodyMatch = sql.match(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${tbl}\\s*\\(([\\s\\S]*?)\\);`, 'i'));
  if (bodyMatch) {
    const body = bodyMatch[1];
    const refs = [...body.matchAll(/REFERENCES\s+([a-zA-Z0-9_.]+)\s*(?:\(([^)]+)\))?/gi)];
    for (const r of refs) {
      const targetTbl = r[1];
      if (targetTbl !== 'auth.users' && !tables.has(targetTbl)) {
        fkErrors.push(`Table ${tbl} references unknown table ${targetTbl}`);
      }
    }
  }
}

// 7. Check ALTER TABLE Foreign Keys
const alterFks = [...sql.matchAll(/ALTER TABLE\s+([a-zA-Z0-9_]+)\s+ADD CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_]+)/gi)];
for (const a of alterFks) {
  if (!tables.has(a[1])) fkErrors.push(`ALTER TABLE references unknown table ${a[1]}`);
  if (!tables.has(a[4])) fkErrors.push(`ALTER TABLE references unknown target table ${a[4]}`);
}

if (fkErrors.length === 0) {
  console.log('[6] Foreign Key Integrity: 100% VALID. All referenced tables exist.');
} else {
  console.error('[6] Foreign Key Errors:', fkErrors);
}

console.log('\n=== STATIC SCHEMA & INTEGRITY AUDIT COMPLETE ===');

