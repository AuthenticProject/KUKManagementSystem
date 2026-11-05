import fs from 'fs';
import path from 'path';

const tempDir = path.resolve('supabase/.temp');
const migrationPath = path.resolve('supabase/migrations/20261104000001_core_schema_v3_1_0.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Load remote JSONs
const remoteEnums = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_enums.json'), 'utf8'));
const remoteExtensions = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_extensions.json'), 'utf8'));
const remoteColumns = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_columns.json'), 'utf8'));
const remoteConstraints = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_constraints.json'), 'utf8'));
const remoteIndexes = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_indexes.json'), 'utf8'));
const remoteFunctions = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_functions.json'), 'utf8'));
const remoteTriggers = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_triggers.json'), 'utf8'));
const remoteRls = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_rls_status.json'), 'utf8'));
const remotePolicies = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_policies.json'), 'utf8'));

const report = {
  enums: { match: [], missing: [], different: [], extra: [] },
  extensions: { match: [], missing: [], different: [], extra: [] },
  tables: { match: [], missing: [], different: [], extra: [] },
  columns: { match: [], missing: [], different: [], extra: [] },
  constraints: { match: [], missing: [], different: [], extra: [] },
  indexes: { match: [], missing: [], different: [], extra: [] },
  triggers: { match: [], missing: [], different: [], extra: [] },
  functions: { match: [], missing: [], different: [], extra: [] },
  rls_status: { match: [], missing: [], different: [], extra: [] },
  policies: { match: [], missing: [], different: [], extra: [] }
};

// 1. Extensions
const expectedExtensions = ['uuid-ossp', 'pgcrypto', 'btree_gist'];
for (const ext of expectedExtensions) {
  const found = remoteExtensions.find(e => e.extname === ext);
  if (found) {
    report.extensions.match.push({ name: ext, version: found.extversion });
  } else {
    report.extensions.missing.push(ext);
  }
}

// 2. Enums
const enumRegex = /CREATE\s+TYPE\s+(?:public\.)?([a-z0-9_]+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);/gi;
let match;
const expectedEnums = {};
while ((match = enumRegex.exec(migrationSql)) !== null) {
  const name = match[1];
  const values = match[2]
    .split(',')
    .map(v => v.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
  expectedEnums[name] = values;
}

for (const [name, expValues] of Object.entries(expectedEnums)) {
  const found = remoteEnums.find(e => e.enum_name === name);
  if (!found) {
    report.enums.missing.push(name);
  } else {
    const actValues = found.values || [];
    if (JSON.stringify(expValues) === JSON.stringify(actValues)) {
      report.enums.match.push(name);
    } else {
      report.enums.different.push({ name, expected: expValues, actual: actValues });
    }
  }
}
for (const e of remoteEnums) {
  if (!expectedEnums[e.enum_name]) {
    report.enums.extra.push(e.enum_name);
  }
}

// 3. Tables & Columns
const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
const expectedTables = {};
while ((match = createTableRegex.exec(migrationSql)) !== null) {
  const tableName = match[1];
  const body = match[2];
  expectedTables[tableName] = body;
}

const remoteTableNames = Array.from(new Set(remoteColumns.map(c => c.table_name)));
for (const t of Object.keys(expectedTables)) {
  if (remoteTableNames.includes(t)) {
    report.tables.match.push(t);
  } else {
    report.tables.missing.push(t);
  }
}
for (const t of remoteTableNames) {
  if (!expectedTables[t]) {
    report.tables.extra.push(t);
  }
}

// 4. RLS Status
for (const t of Object.keys(expectedTables)) {
  const rls = remoteRls.find(r => r.table_name === t);
  if (!rls) {
    report.rls_status.missing.push(t);
  } else if (rls.row_security) {
    report.rls_status.match.push(t);
  } else {
    report.rls_status.different.push({ table: t, row_security: rls.row_security });
  }
}

// 5. Triggers
const expectedTriggers = ['trg_protect_audit_logs', 'trg_protect_payroll_records'];
for (const trg of expectedTriggers) {
  const found = remoteTriggers.find(t => t.trigger_name === trg);
  if (found) {
    report.triggers.match.push(trg);
  } else {
    report.triggers.missing.push(trg);
  }
}
for (const trg of remoteTriggers) {
  if (!expectedTriggers.includes(trg.trigger_name)) {
    report.triggers.extra.push(trg.trigger_name);
  }
}

// 6. Functions / RPCs
const expectedFunctions = [
  'protect_audit_log_immutability',
  'protect_finalized_payroll',
  'generate_document_number_atomic',
  'submit_leave_request_atomic',
  'cancel_leave_request_atomic',
  'book_vehicle_atomic',
  'calculate_and_finalize_payroll_atomic',
  'has_system_role',
  'has_unit_access',
  'has_unit_permission'
];
for (const fn of expectedFunctions) {
  const found = remoteFunctions.find(f => f.function_name === fn);
  if (found) {
    report.functions.match.push({ name: fn, args: found.arguments, return_type: found.return_type });
  } else {
    report.functions.missing.push(fn);
  }
}

// 7. Policies
const policyRegex = /CREATE\s+POLICY\s+["']?([a-z0-9_]+)["']?\s+ON\s+(?:public\.)?([a-z0-9_]+)\s+FOR\s+([A-Z]+)\s+(?:TO\s+([a-z0-9_]+)\s+)?(?:USING\s*\(([\s\S]*?)\))?(?:\s*WITH\s+CHECK\s*\(([\s\S]*?)\))?;/gi;
const expectedPolicies = {};
while ((match = policyRegex.exec(migrationSql)) !== null) {
  const polName = match[1];
  const tableName = match[2];
  const cmd = match[3];
  const toRole = match[4] || 'public';
  expectedPolicies[polName] = { table: tableName, cmd, toRole };
}

for (const [polName, meta] of Object.entries(expectedPolicies)) {
  const found = remotePolicies.find(p => p.policyname === polName && p.tablename === meta.table);
  if (!found) {
    report.policies.missing.push({ policy: polName, table: meta.table });
  } else {
    report.policies.match.push({ policy: polName, table: meta.table, cmd: found.cmd });
  }
}
for (const p of remotePolicies) {
  if (!expectedPolicies[p.policyname]) {
    report.policies.extra.push({ policy: p.policyname, table: p.tablename });
  }
}

// 8. Indexes
const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_]+)\s+ON\s+(?:public\.)?([a-z0-9_]+)/gi;
const expectedIndexes = {};
while ((match = indexRegex.exec(migrationSql)) !== null) {
  const idxName = match[1];
  const tableName = match[2];
  expectedIndexes[idxName] = tableName;
}

for (const [idxName, tableName] of Object.entries(expectedIndexes)) {
  const found = remoteIndexes.find(i => i.indexname === idxName && i.tablename === tableName);
  if (found) {
    report.indexes.match.push({ index: idxName, table: tableName });
  } else {
    report.indexes.missing.push({ index: idxName, table: tableName });
  }
}
for (const i of remoteIndexes) {
  if (!expectedIndexes[i.indexname] && !i.indexname.endsWith('_pkey') && !i.indexname.endsWith('_key')) {
    report.indexes.extra.push({ index: i.indexname, table: i.tablename });
  }
}

fs.writeFileSync(path.join(tempDir, 'schema_diff_summary.json'), JSON.stringify(report, null, 2), 'utf8');

console.log('\n=== RECONCILIATION AUDIT SUMMARY ===');
console.log(`Extensions: ${report.extensions.match.length} MATCH, ${report.extensions.missing.length} MISSING`);
console.log(`Enums: ${report.enums.match.length} MATCH, ${report.enums.missing.length} MISSING, ${report.enums.different.length} DIFFERENT, ${report.enums.extra.length} EXTRA`);
console.log(`Tables: ${report.tables.match.length} MATCH, ${report.tables.missing.length} MISSING, ${report.tables.extra.length} EXTRA`);
console.log(`RLS Enabled on Tables: ${report.rls_status.match.length}/${Object.keys(expectedTables).length} MATCH`);
console.log(`Triggers: ${report.triggers.match.length} MATCH, ${report.triggers.missing.length} MISSING, ${report.triggers.extra.length} EXTRA`);
console.log(`Functions / RPCs: ${report.functions.match.length} MATCH, ${report.functions.missing.length} MISSING`);
console.log(`Policies: ${report.policies.match.length} MATCH, ${report.policies.missing.length} MISSING, ${report.policies.extra.length} EXTRA`);
console.log(`Indexes: ${report.indexes.match.length} MATCH, ${report.indexes.missing.length} MISSING, ${report.indexes.extra.length} EXTRA`);

if (report.policies.missing.length > 0) {
  console.log('Missing policies:', JSON.stringify(report.policies.missing));
}
if (report.policies.extra.length > 0) {
  console.log('Extra policies:', JSON.stringify(report.policies.extra));
}
if (report.indexes.missing.length > 0) {
  console.log('Missing indexes:', JSON.stringify(report.indexes.missing));
}
if (report.indexes.extra.length > 0) {
  console.log('Extra indexes:', JSON.stringify(report.indexes.extra));
}
