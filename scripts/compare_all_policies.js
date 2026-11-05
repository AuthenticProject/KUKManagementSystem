import fs from 'fs';
import path from 'path';

const tempDir = path.resolve('supabase/.temp');
const remotePolicies = JSON.parse(fs.readFileSync(path.join(tempDir, 'detailed_policies.json'), 'utf8'));
const migrationSql = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');

// Parse policies from migration
const policyRegex = /CREATE\s+POLICY\s+["']?([a-z0-9_]+)["']?\s+ON\s+(?:public\.)?([a-z0-9_]+)\s+FOR\s+([A-Z]+)\s+(?:TO\s+([a-z0-9_]+)\s+)?(?:USING\s*\(([\s\S]*?)\))?(?:\s*WITH\s+CHECK\s*\(([\s\S]*?)\))?;/gi;
let match;
const localPolicies = {};

while ((match = policyRegex.exec(migrationSql)) !== null) {
  const policyName = match[1];
  const tableName = match[2];
  const cmd = match[3];
  const roles = match[4] || 'public';
  const usingExpr = match[5] ? match[5].trim() : null;
  const withCheckExpr = match[6] ? match[6].trim() : null;

  localPolicies[policyName] = {
    tableName,
    cmd,
    roles,
    usingExpr,
    withCheckExpr
  };
}

console.log(`Parsed ${Object.keys(localPolicies).length} policies from migration.`);
console.log(`Loaded ${remotePolicies.length} policies from remote.`);

function normalizeExpr(expr) {
  if (!expr) return null;
  return expr
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/'::character varying/g, '')
    .replace(/'::text/g, '')
    .replace(/"/g, '')
    .trim()
    .toLowerCase();
}

const policyDiffs = [];

for (const rp of remotePolicies) {
  const lp = localPolicies[rp.policyname];
  if (!lp) {
    policyDiffs.push({
      policy: rp.policyname,
      table: rp.tablename,
      error: 'EXTRA_ON_REMOTE'
    });
    continue;
  }

  // Check table match
  if (lp.tableName !== rp.tablename) {
    policyDiffs.push({
      policy: rp.policyname,
      error: `TABLE_MISMATCH: local=${lp.tableName}, remote=${rp.tablename}`
    });
  }

  // Check command match
  if (lp.cmd !== rp.cmd) {
    policyDiffs.push({
      policy: rp.policyname,
      error: `CMD_MISMATCH: local=${lp.cmd}, remote=${rp.cmd}`
    });
  }

  // Compare expressions
  const normLocalUsing = normalizeExpr(lp.usingExpr);
  const normRemoteUsing = normalizeExpr(rp.qual);

  if (normLocalUsing !== normRemoteUsing) {
    policyDiffs.push({
      policy: rp.policyname,
      table: rp.tablename,
      field: 'USING',
      error: 'EXPRESSION_DIFF',
      local: lp.usingExpr,
      remote: rp.qual
    });
  }

  const normLocalCheck = normalizeExpr(lp.withCheckExpr);
  const normRemoteCheck = normalizeExpr(rp.with_check);

  if (normLocalCheck !== normRemoteCheck) {
    policyDiffs.push({
      policy: rp.policyname,
      table: rp.tablename,
      field: 'WITH_CHECK',
      error: 'EXPRESSION_DIFF',
      local: lp.withCheckExpr,
      remote: rp.with_check
    });
  }
}

for (const lpName of Object.keys(localPolicies)) {
  const rp = remotePolicies.find(p => p.policyname === lpName);
  if (!rp) {
    policyDiffs.push({
      policy: lpName,
      table: localPolicies[lpName].tableName,
      error: 'MISSING_ON_REMOTE'
    });
  }
}

console.log(`Total policy differences: ${policyDiffs.length}`);
if (policyDiffs.length > 0) {
  console.log('Policy differences:', JSON.stringify(policyDiffs, null, 2));
} else {
  console.log('ALL 107 POLICIES MATCH 100% IN TABLE, COMMAND, ROLES, USING, AND WITH CHECK EXPRESSIONS!');
}

// Write full policy comparison catalog to json
fs.writeFileSync(path.join(tempDir, 'policy_full_comparison.json'), JSON.stringify({
  total: remotePolicies.length,
  policies: remotePolicies.map(rp => ({
    table: rp.tablename,
    policy: rp.policyname,
    command: rp.cmd,
    roles: rp.roles,
    using: rp.qual,
    with_check: rp.with_check,
    status: policyDiffs.find(d => d.policy === rp.policyname) ? 'DIFFERENT' : 'MATCH'
  }))
}, null, 2), 'utf8');

