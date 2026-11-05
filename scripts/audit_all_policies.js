import fs from 'fs';

const sql1 = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');
const sql2 = fs.readFileSync('supabase/migrations/20261104000002_harden_rpc_security.sql', 'utf8');

// Match all CREATE POLICY statements
const policyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_]+)\s+FOR\s+([a-zA-Z]+)\s+TO\s+([a-zA-Z0-9_]+)([\s\S]*?);/g;

const policies = [];
let match;
while ((match = policyRegex.exec(sql1)) !== null) {
  const fullBody = match[0];
  const name = match[1];
  const table = match[2];
  const cmd = match[3];
  const role = match[4];
  const rest = match[5];

  let usingExpr = null;
  let withCheckExpr = null;

  const usingMatch = rest.match(/USING\s*\(([\s\S]*?)\)(?:\s+WITH\s+CHECK|$)/i);
  if (usingMatch) {
    usingExpr = usingMatch[1].trim();
  }

  const checkMatch = rest.match(/WITH\s+CHECK\s*\(([\s\S]*?)\)$/i);
  if (checkMatch) {
    withCheckExpr = checkMatch[1].trim();
  }

  policies.push({
    file: '20261104000001',
    name,
    table,
    cmd,
    role,
    usingExpr,
    withCheckExpr,
    raw: fullBody.replace(/\s+/g, ' ')
  });
}

console.log('Total policies found in 20261104000001:', policies.length);

// Check if any policy in 20261104000002
const policies2 = [];
while ((match = policyRegex.exec(sql2)) !== null) {
  policies2.push(match[1]);
}
console.log('Total policies found in 20261104000002:', policies2.length);

// Group by table
const byTable = {};
policies.forEach(p => {
  if (!byTable[p.table]) byTable[p.table] = [];
  byTable[p.table].push(p);
});

console.log('Total unique tables with policies:', Object.keys(byTable).length);

// Identify targeted policies from user prompt:
const targeted = [
  'glass_tips_insert_anon',
  'public_form_tokens_anon_insert',
  'vehicle_borrowing_requests_insert_anon',
  'audit_logs_insert',
  'profiles_read_authenticated',
  'system_settings_read'
];

console.log('\n--- TARGETED POLICIES CHECK ---');
targeted.forEach(tName => {
  const found = policies.find(p => p.name === tName);
  if (found) {
    console.log(`FOUND: ${tName} on table [${found.table}] FOR [${found.cmd}] TO [${found.role}]`);
    console.log(`  USING: ${found.usingExpr}`);
    console.log(`  WITH CHECK: ${found.withCheckExpr}`);
  } else {
    console.log(`NOT FOUND: ${tName}`);
  }
});

// Write full parsed list to a JSON file for analysis
fs.writeFileSync('supabase/.temp/all_parsed_policies.json', JSON.stringify(policies, null, 2));

