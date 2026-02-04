#!/usr/bin/env tsx
/**
 * 🔧 AUTO VIEW-SAFE MIGRATION PATCHER
 * 
 * Scans all migrations for dangerous DDL patterns that assume TABLE but production has VIEWs.
 * Patches them to be view-safe using DO $$ blocks with pg_class.relkind checks.
 */

import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const REPORT_FILE = path.join(process.cwd(), 'runtime', 'migration_patch_report.md');

// Tables that are known to be VIEWs in production
const VIEW_NAMES = [
  'content_metadata',
  'posted_decisions',
  'real_tweet_metrics',
  'content_with_outcomes',
  'tweet_metrics',
  'tweet_analytics',
  'engagement_snapshots',
];

// Dangerous patterns to find
const DANGEROUS_PATTERNS = [
  {
    name: 'ALTER TABLE ADD COLUMN',
    regex: /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN/gi,
    fix: 'wrap_in_do_block',
  },
  {
    name: 'ALTER TABLE DROP COLUMN',
    regex: /ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN/gi,
    fix: 'wrap_in_do_block',
  },
  {
    name: 'CREATE INDEX ON',
    regex: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+(\w+)/gi,
    fix: 'wrap_in_do_block',
  },
  {
    name: 'DROP TRIGGER',
    regex: /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?\w+\s+ON\s+(\w+)/gi,
    fix: 'wrap_in_do_block',
  },
  {
    name: 'CREATE TRIGGER',
    regex: /CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+(\w+)/gi,
    fix: 'wrap_in_do_block',
  },
];

interface PatchReport {
  filename: string;
  patternsFound: Array<{ pattern: string; tableName: string; line: number }>;
  alreadyPatched: boolean;
  patched: boolean;
}

function isAlreadyPatched(sql: string, tableName: string): boolean {
  // Check if the migration already has view-safe guards for this table
  const relkindCheck = new RegExp(
    `pg_class.*relname\\s*=\\s*['"]${tableName}['"].*relkind\\s*=\\s*['"]r['"]`,
    'i'
  );
  return relkindCheck.test(sql) && sql.includes('DO $$');
}

function wrapInDoBlock(sql: string, tableName: string, statement: string): string {
  // Check if already wrapped
  if (isAlreadyPatched(sql, tableName)) {
    return sql;
  }

  // Find the statement in the SQL
  const statementRegex = new RegExp(
    statement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i'
  );
  
  if (!statementRegex.test(sql)) {
    return sql; // Statement not found, skip
  }

  // Create the wrapped version
  const wrapped = `
-- View-safe wrapper for ${tableName}
DO $$
BEGIN
  -- Check if ${tableName} is a base table
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = '${tableName}'
    AND c.relkind = 'r'
  ) THEN
    BEGIN
      EXECUTE '${statement.replace(/'/g, "''")}';
    EXCEPTION 
      WHEN SQLSTATE '42809' THEN
        RAISE NOTICE 'Skipping DDL on ${tableName}: relation is a view/materialized view';
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not execute DDL on ${tableName}: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Skipping DDL on ${tableName}: not a base table (likely a view)';
  END IF;
END $$;
`;

  // Replace the statement with wrapped version
  return sql.replace(statementRegex, wrapped);
}

function scanAndPatchMigration(filePath: string): PatchReport {
  const filename = path.basename(filePath);
  const sql = fs.readFileSync(filePath, 'utf-8');
  const lines = sql.split('\n');
  
  const report: PatchReport = {
    filename,
    patternsFound: [],
    alreadyPatched: false,
    patched: false,
  };

  let modifiedSql = sql;
  let hasChanges = false;

  // Check each dangerous pattern
  for (const pattern of DANGEROUS_PATTERNS) {
    const matches = [...sql.matchAll(pattern.regex)];
    
    for (const match of matches) {
      const tableName = match[1];
      
      // Only patch if it's a known view name
      if (!VIEW_NAMES.includes(tableName.toLowerCase())) {
        continue;
      }

      // Find line number
      const matchIndex = match.index!;
      const lineNumber = sql.substring(0, matchIndex).split('\n').length;

      report.patternsFound.push({
        pattern: pattern.name,
        tableName,
        line: lineNumber,
      });

      // Check if already patched
      if (isAlreadyPatched(sql, tableName)) {
        report.alreadyPatched = true;
        continue;
      }

      // Extract the full statement (simplified - find semicolon or end of line)
      const statementStart = matchIndex;
      const statementEnd = sql.indexOf(';', statementStart);
      if (statementEnd === -1) continue;
      
      const statement = sql.substring(statementStart, statementEnd + 1).trim();
      
      // Wrap in DO block
      const wrapped = wrapInDoBlock(modifiedSql, tableName, statement);
      if (wrapped !== modifiedSql) {
        modifiedSql = wrapped;
        hasChanges = true;
        report.patched = true;
      }
    }
  }

  // Write back if changed
  if (hasChanges) {
    fs.writeFileSync(filePath, modifiedSql, 'utf-8');
  }

  return report;
}

async function main() {
  console.log('🔍 Scanning migrations for view-unsafe DDL patterns...\n');

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📋 Found ${files.length} migration files\n`);

  const reports: PatchReport[] = [];
  let totalPatternsFound = 0;
  let totalPatched = 0;
  let totalAlreadyPatched = 0;

  for (const filename of files) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const report = scanAndPatchMigration(filePath);
    reports.push(report);

    if (report.patternsFound.length > 0) {
      totalPatternsFound += report.patternsFound.length;
      if (report.alreadyPatched) {
        totalAlreadyPatched++;
      }
      if (report.patched) {
        totalPatched++;
        console.log(`✅ Patched: ${filename} (${report.patternsFound.length} patterns)`);
      } else if (report.alreadyPatched) {
        console.log(`⏭️  Already patched: ${filename}`);
      } else {
        console.log(`⚠️  Found patterns but couldn't patch: ${filename}`);
      }
    }
  }

  // Write report
  const reportDir = path.dirname(REPORT_FILE);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportContent = `# Migration Patch Report

Generated: ${new Date().toISOString()}

## Summary

- **Total migrations scanned:** ${files.length}
- **Migrations with dangerous patterns:** ${reports.filter(r => r.patternsFound.length > 0).length}
- **Patterns found:** ${totalPatternsFound}
- **Already patched:** ${totalAlreadyPatched}
- **Newly patched:** ${totalPatched}

## Details

${reports
  .filter(r => r.patternsFound.length > 0)
  .map(r => `
### ${r.filename}

- **Patterns found:** ${r.patternsFound.length}
- **Already patched:** ${r.alreadyPatched ? 'Yes' : 'No'}
- **Patched:** ${r.patched ? 'Yes' : 'No'}

Patterns:
${r.patternsFound.map(p => `- ${p.pattern} on \`${p.tableName}\` (line ${p.line})`).join('\n')}
`).join('\n')}
`;

  fs.writeFileSync(REPORT_FILE, reportContent, 'utf-8');

  console.log(`\n✅ Scan complete!`);
  console.log(`   Patterns found: ${totalPatternsFound}`);
  console.log(`   Already patched: ${totalAlreadyPatched}`);
  console.log(`   Newly patched: ${totalPatched}`);
  console.log(`\n📄 Report written to: ${REPORT_FILE}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
