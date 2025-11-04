#!/usr/bin/env tsx
/**
 * 🗄️ REPLY TABLE AUDIT
 * Identifies which reply tables are active vs unused
 */

import { getSupabaseClient } from '../src/db';

const supabase = getSupabaseClient();

interface TableInfo {
  name: string;
  purpose: string;
  status: 'active' | 'deprecated' | 'unknown';
  rowCount?: number;
  lastUpdated?: string;
}

async function auditReplyTables() {
  console.log('🗄️ REPLY TABLE AUDIT\n');
  console.log('═'.repeat(80));
  
  const tables: TableInfo[] = [
    {
      name: 'reply_opportunities',
      purpose: 'Active: Stores tweets to reply to',
      status: 'active'
    },
    {
      name: 'content_metadata',
      purpose: 'Active: Queued and posted replies (decision_type=reply)',
      status: 'active'
    },
    {
      name: 'reply_conversions',
      purpose: 'Active: Performance tracking for replies',
      status: 'active'
    },
    {
      name: 'discovered_accounts',
      purpose: 'Active: Accounts to monitor',
      status: 'active'
    },
    {
      name: 'reply_targets',
      purpose: 'Deprecated?: From growth_experiments migration',
      status: 'unknown'
    },
    {
      name: 'real_reply_opportunities',
      purpose: 'Deprecated?: Old AI-driven system',
      status: 'unknown'
    },
    {
      name: 'titan_reply_performance',
      purpose: 'Unknown: Separate titan system?',
      status: 'unknown'
    },
    {
      name: 'strategic_replies',
      purpose: 'Unknown: Strategic reply tracking?',
      status: 'unknown'
    },
    {
      name: 'reply_diagnostics',
      purpose: 'Unknown: Diagnostic logging?',
      status: 'unknown'
    },
    {
      name: 'reply_strategy_metrics',
      purpose: 'Unknown: Strategy performance?',
      status: 'unknown'
    },
    {
      name: 'reply_learning_insights',
      purpose: 'Unknown: Learning system data?',
      status: 'unknown'
    }
  ];
  
  console.log('\n📊 Checking table existence and row counts...\n');
  
  for (const table of tables) {
    try {
      // Check if table exists and get row count
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log(`❌ ${table.name}`);
          console.log(`   Status: TABLE DOES NOT EXIST`);
          console.log(`   Purpose: ${table.purpose}`);
          console.log(`   Action: No cleanup needed\n`);
        } else {
          console.log(`⚠️  ${table.name}`);
          console.log(`   Error: ${error.message}`);
          console.log(`   Purpose: ${table.purpose}\n`);
        }
        continue;
      }
      
      table.rowCount = count || 0;
      
      // Get last updated if possible
      try {
        const { data: lastRow } = await supabase
          .from(table.name)
          .select('updated_at, created_at')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .single();
        
        if (lastRow) {
          table.lastUpdated = lastRow.updated_at || lastRow.created_at;
        }
      } catch (e) {
        // No updated_at column, that's fine
      }
      
      // Determine if active based on row count and recency
      let statusIcon = '✅';
      let recommendation = 'KEEP - Active table';
      
      if (count === 0) {
        statusIcon = '⚠️';
        recommendation = 'CONSIDER DROPPING - Empty table';
        table.status = 'deprecated';
      } else if (table.lastUpdated) {
        const daysSinceUpdate = (Date.now() - new Date(table.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 30) {
          statusIcon = '⚠️';
          recommendation = `CONSIDER DROPPING - No updates in ${Math.round(daysSinceUpdate)} days`;
          table.status = 'deprecated';
        }
      }
      
      console.log(`${statusIcon} ${table.name}`);
      console.log(`   Rows: ${count?.toLocaleString() || 0}`);
      console.log(`   Last Updated: ${table.lastUpdated ? new Date(table.lastUpdated).toLocaleDateString() : 'Unknown'}`);
      console.log(`   Purpose: ${table.purpose}`);
      console.log(`   Status: ${table.status.toUpperCase()}`);
      console.log(`   Recommendation: ${recommendation}\n`);
      
    } catch (error: any) {
      console.log(`❌ ${table.name}`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  // Summary
  console.log('═'.repeat(80));
  console.log('\n📋 SUMMARY\n');
  
  const active = tables.filter(t => t.status === 'active').length;
  const deprecated = tables.filter(t => t.status === 'deprecated').length;
  const unknown = tables.filter(t => t.status === 'unknown').length;
  
  console.log(`✅ Active Tables: ${active}`);
  console.log(`⚠️  Deprecated/Empty: ${deprecated}`);
  console.log(`❓ Unknown Status: ${unknown}\n`);
  
  // Recommendations
  const toDelete = tables.filter(t => t.rowCount === 0);
  const toReview = tables.filter(t => t.status === 'unknown' && t.rowCount && t.rowCount > 0);
  
  if (toDelete.length > 0) {
    console.log('🗑️  SAFE TO DELETE (Empty tables):');
    toDelete.forEach(t => console.log(`   • ${t.name}`));
    console.log('');
  }
  
  if (toReview.length > 0) {
    console.log('🔍 NEED MANUAL REVIEW (Has data, unclear purpose):');
    toReview.forEach(t => {
      console.log(`   • ${t.name} (${t.rowCount?.toLocaleString()} rows)`);
    });
    console.log('');
  }
  
  // Generate cleanup script
  if (toDelete.length > 0) {
    console.log('📝 CLEANUP SCRIPT (Run in Supabase SQL Editor):\n');
    console.log('BEGIN;');
    console.log('-- Backup first! Export these tables if you want to keep data\n');
    toDelete.forEach(t => {
      console.log(`-- DROP TABLE IF EXISTS ${t.name} CASCADE;`);
    });
    console.log('\n-- COMMIT; -- Uncomment when ready to execute');
    console.log('');
  }
}

auditReplyTables().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});

