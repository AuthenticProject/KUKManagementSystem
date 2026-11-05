import fs from 'fs';

const policies = JSON.parse(fs.readFileSync('supabase/.temp/all_parsed_policies.json', 'utf8'));

// Categorize policies by role
const byRole = {};
const byCmd = {};
const anonPolicies = [];
const widePolicies = []; // USING (true) or WITH CHECK (true)
const allCmdPolicies = [];

policies.forEach(p => {
  byRole[p.role] = (byRole[p.role] || 0) + 1;
  byCmd[p.cmd] = (byCmd[p.cmd] || 0) + 1;

  if (p.role === 'anon' || p.role === 'public') {
    anonPolicies.push(p);
  }

  if (p.cmd === 'ALL') {
    allCmdPolicies.push(p);
  }

  if (p.usingExpr === 'true' || p.withCheckExpr === 'true') {
    widePolicies.push(p);
  }
});

console.log('=== SUMMARY BY ROLE ===', byRole);
console.log('=== SUMMARY BY COMMAND ===', byCmd);
console.log('\n=== POLICIES FOR anon / public ===');
anonPolicies.forEach(p => {
  console.log(`Table: ${p.table.padEnd(28)} | Name: ${p.name.padEnd(38)} | Cmd: ${p.cmd.padEnd(7)} | Role: ${p.role.padEnd(14)} | USING: ${p.usingExpr} | WITH CHECK: ${p.withCheckExpr}`);
});

console.log(`\nTotal policies with USING(true) or WITH CHECK(true): ${widePolicies.length}`);
widePolicies.forEach(p => {
  console.log(`Table: ${p.table.padEnd(28)} | Name: ${p.name.padEnd(38)} | Cmd: ${p.cmd.padEnd(7)} | Role: ${p.role.padEnd(14)} | USING: ${p.usingExpr} | WITH CHECK: ${p.withCheckExpr}`);
});

console.log(`\nTotal policies with FOR ALL: ${allCmdPolicies.length}`);
allCmdPolicies.forEach(p => {
  console.log(`Table: ${p.table.padEnd(28)} | Name: ${p.name.padEnd(38)} | Role: ${p.role.padEnd(14)} | USING: ${p.usingExpr}`);
});

