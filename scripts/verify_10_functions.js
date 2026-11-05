import fs from 'fs';
import path from 'path';

const tempDir = path.resolve('supabase/.temp');
const funcs = JSON.parse(fs.readFileSync(path.join(tempDir, 'detailed_functions.json'), 'utf8'));
const grants = JSON.parse(fs.readFileSync(path.join(tempDir, 'function_grants.json'), 'utf8'));
const migrationSql = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');

console.log('=== 10 FUNCTIONS AUDIT ===');
for (const f of funcs) {
  console.log(`\nFunction: ${f.function_name}`);
  console.log(`  Arguments: ${f.arguments}`);
  console.log(`  Return Type: ${f.return_type}`);
  console.log(`  Security Definer: ${f.is_security_definer}`);
  console.log(`  Volatility: ${f.volatility}`);
  console.log(`  Language: ${f.language}`);

  // Find grants
  const fnGrants = grants.filter(g => g.routine_name === f.function_name);
  console.log(`  Grants: ${fnGrants.map(g => `${g.grantee}:${g.privilege_type}`).join(', ')}`);
}

