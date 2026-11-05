import fs from 'fs';
import path from 'path';

const tempDir = path.resolve('supabase/.temp');
const remoteFuncs = JSON.parse(fs.readFileSync(path.join(tempDir, 'detailed_functions.json'), 'utf8'));
const migrationSql = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');

function cleanBody(code) {
  // Extract body between AS $...$ and $...$;
  const match = code.match(/AS\s+\$([a-zA-Z0-9_]*)\$([\s\S]*?)\$\1\$/i);
  if (!match) return '';
  let body = match[2];
  // Remove comments
  body = body.replace(/--.*$/gm, '');
  // Normalize whitespace, punctuation, quotes, case
  body = body.replace(/\s+/g, ' ')
    .replace(/'::character varying/g, "'")
    .replace(/'::text/g, "'")
    .replace(/"/g, '')
    .trim()
    .toLowerCase();
  return body;
}

console.log('=== SUBSTANTIVE FUNCTION BODY COMPARISON (BODY CLEANED) ===');

for (const rf of remoteFuncs) {
  const name = rf.function_name;
  
  // Find in migration
  const regex = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${name}\\s*\\([\\s\\S]*?\\)\\s+RETURNS[\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$;`, 'i');
  const mMatch = migrationSql.match(regex);
  if (!mMatch) {
    console.log(`[NOT FOUND IN MIGRATION]: ${name}`);
    continue;
  }

  const localBody = cleanBody(mMatch[0]);
  const remoteBody = cleanBody(rf.definition);

  if (localBody === remoteBody) {
    console.log(`[100% MATCH]: ${name} (Length: ${localBody.length} chars)`);
  } else {
    console.log(`[DIFFERENCE]: ${name}`);
    console.log(`  Local len: ${localBody.length}, Remote len: ${remoteBody.length}`);
    let diffAt = 0;
    while (diffAt < localBody.length && localBody[diffAt] === remoteBody[diffAt]) {
      diffAt++;
    }
    console.log(`  Diff at char ${diffAt}:`);
    console.log(`    Local : ...${localBody.substring(Math.max(0, diffAt - 15), diffAt + 35)}...`);
    console.log(`    Remote: ...${remoteBody.substring(Math.max(0, diffAt - 15), diffAt + 35)}...`);
  }
}
