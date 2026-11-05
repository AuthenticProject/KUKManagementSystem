import fs from 'fs';

const sql = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');
const section14Idx = sql.indexOf('SECTION 14: ROW LEVEL SECURITY');
const section14 = sql.substring(section14Idx);
const lines = section14.split('\n').filter(l => l.startsWith('CREATE POLICY'));

for (const l of lines) {
  console.log(l);
}

