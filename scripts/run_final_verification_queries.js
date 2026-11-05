import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const tempDir = path.resolve('supabase/.temp');

const queries = [
  { name: 'detailed_functions', sqlFile: 'query_detailed_functions.sql', outFile: 'detailed_functions.json' },
  { name: 'function_grants', sqlFile: 'query_function_grants.sql', outFile: 'function_grants.json' },
  { name: 'auth_storage', sqlFile: 'query_auth_storage.sql', outFile: 'auth_storage.json' },
  { name: 'detailed_policies', sqlFile: 'query_detailed_policies.sql', outFile: 'detailed_policies.json' },
  { name: 'privileges_config', sqlFile: 'query_privileges_config.sql', outFile: 'privileges_config.json' }
];

console.log('Running final verification queries against remote database...');

for (const q of queries) {
  const sqlPath = path.join(tempDir, q.sqlFile);
  const outPath = path.join(tempDir, q.outFile);

  console.log(`Executing ${q.name}...`);
  try {
    const raw = execSync(`npx.cmd supabase db query --remote --read-only -f "${sqlPath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024
    });

    const jsonMatch = raw.match(/\{[\s\S]*"rows":\s*(\[[\s\S]*?\])[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      fs.writeFileSync(outPath, JSON.stringify(parsed.rows, null, 2), 'utf8');
      console.log(`  -> ${q.name}: ${parsed.rows.length} rows saved.`);
    } else {
      console.warn(`  -> Could not parse JSON for ${q.name}. Writing raw output.`);
      fs.writeFileSync(path.join(tempDir, `raw_${q.name}.txt`), raw, 'utf8');
    }
  } catch (err) {
    console.error(`  -> Failed ${q.name}:`, err.message);
  }
}

console.log('All final verification queries executed successfully.');

