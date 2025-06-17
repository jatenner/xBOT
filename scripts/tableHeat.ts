#!/usr/bin/env ts-node

import { readFileSync } from 'fs';
import { join } from 'path';
import { supabase } from '../src/utils/supabaseClient';

interface TableAuditResult {
  table_name: string;
  row_count: number;
  table_size: string;
  size_bytes: number;
  last_vacuum: string | null;
  last_analyze: string | null;
  activity_status: 'ACTIVE' | 'EMPTY' | 'STALE';
  total_operations: number;
  inserts: number;
  updates: number;
  deletes: number;
  cleanup_recommendation: 'HIGH_CLEANUP_CANDIDATE' | 'MEDIUM_CLEANUP_CANDIDATE' | 'LOW_CLEANUP_CANDIDATE' | 'KEEP_ACTIVE';
  maintenance_age: 'RECENT' | 'MODERATE' | 'OLD' | 'VERY_OLD';
}

interface CodeReference {
  table: string;
  file: string;
  line: number;
  context: string;
}

async function runTableAudit(): Promise<void> {
  console.log('🔍 === DATABASE TABLE AUDIT ===\n');
  
  try {
    // Read and execute the audit SQL
    const auditSQL = readFileSync(join(__dirname, 'table_audit.sql'), 'utf-8');
    
    console.log('📊 Running table analysis...\n');
    
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    
    // Execute the audit query
    const { data: auditResults, error } = await supabase.rpc('execute_sql', { 
      sql: auditSQL 
    }) as { data: TableAuditResult[], error: any };
    
    if (error) {
      // Fallback: Try direct query if RPC doesn't work
      console.log('⚠️  RPC not available, trying direct queries...\n');
      await runDirectQueries();
      return;
    }
    
    if (!auditResults || auditResults.length === 0) {
      console.log('❌ No audit results returned');
      return;
    }
    
    // Display results in a formatted table
    console.log('📋 TABLE AUDIT RESULTS:\n');
    console.table(auditResults.map(row => ({
      Table: row.table_name,
      Rows: row.row_count.toLocaleString(),
      Size: row.table_size,
      Status: row.activity_status,
      Operations: row.total_operations,
      Recommendation: row.cleanup_recommendation,
      'Maintenance Age': row.maintenance_age
    })));
    
    // Analyze and categorize results
    await analyzeResults(auditResults);
    
    // Scan codebase for table references
    await scanCodebaseReferences();
    
  } catch (error) {
    console.error('❌ Error running table audit:', error);
    console.log('\n💡 Trying fallback method...\n');
    await runDirectQueries();
  }
}

async function runDirectQueries(): Promise<void> {
  try {
    // Basic table stats query
    const basicStatsQuery = `
      SELECT 
        relname as table_name,
        n_live_tup as row_count,
        pg_size_pretty(pg_relation_size(relid)) as table_size
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_relation_size(relid) DESC;
    `;
    
    const { data: basicStats, error } = await supabase!
      .from('pg_stat_user_tables')
      .select('*');
    
    if (error) {
      console.log('⚠️  Direct query failed, showing manual analysis...');
      await manualTableAnalysis();
      return;
    }
    
    console.log('📊 Basic Table Statistics:\n');
    console.table(basicStats);
    
  } catch (error) {
    console.error('❌ Direct queries failed:', error);
    await manualTableAnalysis();
  }
}

async function manualTableAnalysis(): Promise<void> {
  console.log('🔧 Manual table analysis (checking actual table data)...\n');
  
  const knownTables = [
    'tweets', 'replies', 'target_tweets', 'engagement_analytics',
    'learning_insights', 'content_themes', 'timing_insights', 
    'style_performance', 'bot_config', 'control_flags', 'api_usage',
    'content_recycling', 'media_history', 'news_cache'
  ];
  
  const results: Array<{Table: string, Status: string, Count: string, Note: string}> = [];
  
  for (const table of knownTables) {
    try {
      const { count, error } = await supabase!
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results.push({
          Table: table,
          Status: 'ERROR',
          Count: 'N/A',
          Note: error.message
        });
      } else {
        const rowCount = count || 0;
        results.push({
          Table: table,
          Status: rowCount === 0 ? 'EMPTY' : rowCount > 100 ? 'ACTIVE' : 'LOW_ACTIVITY',
          Count: rowCount.toLocaleString(),
          Note: rowCount === 0 ? 'Cleanup candidate' : 'In use'
        });
      }
    } catch (err) {
      results.push({
        Table: table,
        Status: 'UNKNOWN',
        Count: 'N/A',
        Note: 'Access denied or table missing'
      });
    }
  }
  
  console.table(results);
}

async function analyzeResults(results: TableAuditResult[]): Promise<void> {
  console.log('\n🎯 ANALYSIS SUMMARY:\n');
  
  const summary = {
    total_tables: results.length,
    active_tables: results.filter(r => r.activity_status === 'ACTIVE').length,
    empty_tables: results.filter(r => r.activity_status === 'EMPTY').length,
    stale_tables: results.filter(r => r.activity_status === 'STALE').length,
    cleanup_candidates: results.filter(r => r.cleanup_recommendation.includes('CLEANUP_CANDIDATE')).length,
    total_size_mb: Math.round(results.reduce((sum, r) => sum + r.size_bytes, 0) / (1024 * 1024))
  };
  
  console.log(`📊 Total Tables: ${summary.total_tables}`);
  console.log(`✅ Active Tables: ${summary.active_tables}`);
  console.log(`📭 Empty Tables: ${summary.empty_tables}`);
  console.log(`⚠️  Stale Tables: ${summary.stale_tables}`);
  console.log(`🗑️  Cleanup Candidates: ${summary.cleanup_candidates}`);
  console.log(`💾 Total Database Size: ${summary.total_size_mb} MB\n`);
  
  // Show cleanup candidates
  const cleanupCandidates = results.filter(r => 
    r.cleanup_recommendation.includes('CLEANUP_CANDIDATE')
  );
  
  if (cleanupCandidates.length > 0) {
    console.log('🗑️  CLEANUP CANDIDATES:\n');
    console.table(cleanupCandidates.map(table => ({
      Table: table.table_name,
      Rows: table.row_count,
      Size: table.table_size,
      Risk: table.cleanup_recommendation,
      Reason: table.row_count === 0 ? 'Empty table' : 'Low activity'
    })));
  }
}

async function scanCodebaseReferences(): Promise<void> {
  console.log('\n🔍 SCANNING CODEBASE FOR TABLE REFERENCES:\n');
  
  const { execSync } = await import('child_process');
  const { readdirSync, statSync } = await import('fs');
  
  const tableNames = [
    'tweets', 'replies', 'target_tweets', 'engagement_analytics',
    'learning_insights', 'content_themes', 'timing_insights',
    'style_performance', 'bot_config', 'control_flags', 'api_usage',
    'content_recycling', 'media_history', 'news_cache'
  ];
  
  const references: { [key: string]: number } = {};
  
  for (const table of tableNames) {
    try {
      // Search for .from('table_name') patterns
      const result = execSync(
        `grep -r "from.*'${table}'\\|from.*\"${table}\"" src/ --include="*.ts" --include="*.js" | wc -l`,
        { encoding: 'utf-8', cwd: process.cwd() }
      );
      
      const count = parseInt(result.trim()) || 0;
      references[table] = count;
    } catch (error) {
      references[table] = 0;
    }
  }
  
  console.log('📝 Table References in Code:\n');
  
  const refResults = Object.entries(references).map(([table, count]) => ({
    Table: table,
    References: count,
    Status: count === 0 ? '⚠️  UNUSED' : count > 5 ? '✅ ACTIVE' : '⚡ MODERATE'
  }));
  
  console.table(refResults);
  
  const unusedTables = Object.entries(references)
    .filter(([_, count]) => count === 0)
    .map(([table, _]) => table);
  
  if (unusedTables.length > 0) {
    console.log(`\n⚠️  TABLES WITH NO CODE REFERENCES: ${unusedTables.join(', ')}`);
    console.log('💡 These may be safe to rename with zzz_ prefix\n');
  }
}

// Helper function to generate cleanup migration
function generateCleanupMigration(candidates: string[]): void {
  if (candidates.length === 0) return;
  
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const migrationSQL = `-- Migration: Soft delete unused tables
-- Generated: ${new Date().toISOString()}
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS!

${candidates.map(table => 
  `-- Rename ${table} to mark as unused
ALTER TABLE ${table} RENAME TO zzz_${table}_unused_${date};`
).join('\n\n')}

-- To restore a table, use:
-- ALTER TABLE zzz_tablename_unused_${date} RENAME TO tablename;
`;
  
  console.log('\n📄 SUGGESTED CLEANUP MIGRATION:\n');
  console.log(migrationSQL);
}

// Run the audit
if (require.main === module) {
  runTableAudit()
    .then(() => {
      console.log('\n✅ Table audit completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Audit failed:', error);
      process.exit(1);
    });
}

export { runTableAudit }; 