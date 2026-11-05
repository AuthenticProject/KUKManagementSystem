import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const queries = {
  enums: `
    SELECT t.typname as enum_name, json_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    GROUP BY t.typname
    ORDER BY t.typname;
  `,
  extensions: `
    SELECT extname, extversion FROM pg_extension ORDER BY extname;
  `,
  columns: `
    SELECT 
      c.relname as table_name,
      a.attname as column_name,
      a.attnum as ordinal_position,
      format_type(a.atttypid, a.atttypmod) as data_type,
      NOT a.attnotnull as is_nullable,
      pg_get_expr(d.adbin, d.adrelid) as column_default
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r' 
      AND a.attnum > 0 
      AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum;
  `,
  constraints: `
    SELECT
      c.conname as constraint_name,
      c.contype as constraint_type,
      c_rel.relname as table_name,
      ARRAY(
        SELECT attname FROM pg_attribute
        WHERE attrelid = c.conrelid AND attnum = ANY(c.conkey)
      ) as columns,
      f_rel.relname as foreign_table_name,
      ARRAY(
        SELECT attname FROM pg_attribute
        WHERE attrelid = c.confrelid AND attnum = ANY(c.confkey)
      ) as foreign_columns,
      c.confupdtype as update_type,
      c.confdeltype as delete_type,
      pg_get_constraintdef(c.oid) as definition
    FROM pg_constraint c
    JOIN pg_class c_rel ON c_rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = c_rel.relnamespace
    LEFT JOIN pg_class f_rel ON f_rel.oid = c.confrelid
    WHERE n.nspname = 'public'
    ORDER BY c_rel.relname, c.conname;
  `,
  indexes: `
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `,
  functions: `
    SELECT
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_function_result(p.oid) as return_type,
      l.lanname as language,
      p.prosecdef as security_definer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `,
  triggers: `
    SELECT
      t.tgname as trigger_name,
      c.relname as table_name,
      p.proname as function_name,
      pg_get_triggerdef(t.oid) as definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname;
  `,
  rls_status: `
    SELECT
      relname as table_name,
      relrowsecurity as row_security,
      relforcerowsecurity as force_row_security
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY relname;
  `,
  policies: `
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `
};

const tempDir = path.resolve('supabase/.temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log('Extracting exact schema objects via pg_catalog...');

for (const [key, sql] of Object.entries(queries)) {
  const sqlFile = path.join(tempDir, `query_${key}.sql`);
  const outFile = path.join(tempDir, `remote_${key}.json`);
  fs.writeFileSync(sqlFile, sql.trim(), 'utf8');

  console.log(`Extracting ${key}...`);
  try {
    const raw = execSync(`npx.cmd supabase db query --remote --read-only -f "${sqlFile}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024
    });

    const jsonMatch = raw.match(/\{[\s\S]*"rows":\s*(\[[\s\S]*?\])[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      fs.writeFileSync(outFile, JSON.stringify(parsed.rows, null, 2), 'utf8');
      console.log(`  -> ${key}: ${parsed.rows.length} records saved.`);
    } else {
      console.warn(`  -> Could not parse JSON for ${key}.`);
      fs.writeFileSync(path.join(tempDir, `raw_${key}.txt`), raw, 'utf8');
    }
  } catch (err) {
    console.error(`  -> Failed to extract ${key}:`, err.message);
  }
}

console.log('All extractions complete.');
