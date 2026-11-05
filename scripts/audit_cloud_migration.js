import fs from 'fs';

const sql = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');

console.log('=== AUDITING MIGRATION FOR SUPABASE CLI & CLOUD COMPATIBILITY ===');

// 1. Check for psql meta-commands (lines starting with \)
const lines = sql.split('\n');
const psqlCommands = [];
lines.forEach((l, i) => {
  if (l.trim().startsWith('\\')) {
    psqlCommands.push({ line: i + 1, content: l.trim() });
  }
});
console.log('[1] PSQL meta-commands (\\...) found:', psqlCommands.length);
if (psqlCommands.length > 0) console.log(psqlCommands);

// 2. Check for destructive statements (DROP, TRUNCATE, DELETE FROM)
const dropMatches = [...sql.matchAll(/\b(DROP\s+TABLE|DROP\s+SCHEMA|DROP\s+DATABASE|TRUNCATE)\b/gi)];
console.log('[2] Destructive statements (DROP/TRUNCATE) found:', dropMatches.length);
if (dropMatches.length > 0) {
  dropMatches.forEach(m => console.log('Match:', m[0]));
}

// 3. Check for CREATE EXTENSION
const extensions = [...sql.matchAll(/CREATE EXTENSION IF NOT EXISTS\s+"([^"]+)"/gi)];
console.log('[3] Extensions created:', extensions.map(e => e[1]));

// 4. Check for references to auth.users
const authUsersRefs = [...sql.matchAll(/REFERENCES\s+auth\.users(?:\(([^)]+)\))?/gi)];
console.log('[4] References to auth.users count:', authUsersRefs.length);

// 5. Check for grants/revokes
const grants = [...sql.matchAll(/\b(GRANT|REVOKE)\b/gi)];
console.log('[5] Explicit GRANT/REVOKE statements:', grants.length);

// 6. Check for transactions (BEGIN / COMMIT)
const txCommands = [...sql.matchAll(/\b(BEGIN|COMMIT|ROLLBACK)\b;/gi)];
console.log('[6] Explicit transaction blocks (BEGIN/COMMIT):', txCommands.length);

// 7. Check for search_path setting in functions
const secDefinerFns = [...sql.matchAll(/CREATE OR REPLACE FUNCTION ([a-zA-Z0-9_]+)[\s\S]*?SECURITY DEFINER[\s\S]*?AS/gi)];
console.log('[7] SECURITY DEFINER functions count:', secDefinerFns.length);
secDefinerFns.forEach(fn => {
  const hasSearchPath = fn[0].includes('search_path');
  console.log(`- Function: ${fn[1].padEnd(40)} has search_path: ${hasSearchPath}`);
});

console.log('=== AUDIT COMPLETE ===');

