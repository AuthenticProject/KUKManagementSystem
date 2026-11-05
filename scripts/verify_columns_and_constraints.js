import fs from 'fs';
import path from 'path';

const tempDir = path.resolve('supabase/.temp');
const remoteColumns = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_columns.json'), 'utf8'));
const remoteConstraints = JSON.parse(fs.readFileSync(path.join(tempDir, 'remote_constraints.json'), 'utf8'));

console.log('=== COLUMN AUDIT ===');
console.log(`Total columns on remote: ${remoteColumns.length}`);

// Group columns by table
const colsByTable = {};
for (const col of remoteColumns) {
  colsByTable[col.table_name] = colsByTable[col.table_name] || [];
  colsByTable[col.table_name].push(col);
}

const tableNames = Object.keys(colsByTable).sort();
console.log(`Total tables on remote: ${tableNames.length}`);

// Check PK presence for all tables
const pks = remoteConstraints.filter(c => c.constraint_type === 'p');
console.log(`\n=== PRIMARY KEY AUDIT ===`);
console.log(`Tables with Primary Key: ${pks.length}/60`);
const tablesWithoutPK = tableNames.filter(t => !pks.find(p => p.table_name === t));
if (tablesWithoutPK.length > 0) {
  console.log('Tables missing PK:', tablesWithoutPK);
} else {
  console.log('ALL 60 TABLES HAVE PRIMARY KEYS DEFINED.');
}

// Check Foreign Keys
const fks = remoteConstraints.filter(c => c.constraint_type === 'f');
console.log(`\n=== FOREIGN KEY AUDIT ===`);
console.log(`Total Foreign Keys on remote: ${fks.length}`);

// Check Unique Constraints & Exclusion Constraints
const uqs = remoteConstraints.filter(c => c.constraint_type === 'u');
const excls = remoteConstraints.filter(c => c.constraint_type === 'x');
const checks = remoteConstraints.filter(c => c.constraint_type === 'c');

console.log(`Total Unique Constraints (explicit): ${uqs.length}`);
console.log(`Total Exclusion Constraints: ${excls.length}`);
console.log(`Total Check Constraints: ${checks.length}`);

console.log('\nExclusion constraints:');
for (const x of excls) {
  console.log(`  Table: ${x.table_name}, Constraint: ${x.constraint_name}, Def: ${x.definition}`);
}

