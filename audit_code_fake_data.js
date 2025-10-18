#!/usr/bin/env node
/**
 * 🔍 PHASE 2: CODE AUDIT FOR FAKE DATA SOURCES
 * 
 * Searches entire codebase for patterns that could create fake data:
 * - || 0 defaults
 * - Math.random() usage
 * - Hardcoded values
 * - Database writes without proper null handling
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('════════════════════════════════════════════════════════════');
console.log('🔍 FAKE DATA CODE AUDIT - PHASE 2');
console.log('════════════════════════════════════════════════════════════\n');

const report = {
  timestamp: new Date().toISOString(),
  patterns_found: {},
  files_to_fix: [],
  files_already_fixed: [],
  severity: 'unknown'
};

// ═══════════════════════════════════════════════════════════
// PATTERN 1: Dangerous || 0 defaults
// ═══════════════════════════════════════════════════════════
console.log('🔍 PATTERN 1: Searching for "|| 0" in metrics code...\n');

try {
  const cmd = `grep -r "|| 0" src/ --include="*.ts" | grep -E "(likes|retweets|replies|views|impressions|followers|metrics)" | grep -v "node_modules" | grep -v ".backup" | grep -v "test"`;
  const result = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
  
  if (result) {
    const lines = result.split('\n');
    console.log(`   Found ${lines.length} instances of "|| 0" in metrics-related code`);
    
    // Group by file
    const fileGroups = {};
    lines.forEach(line => {
      const file = line.split(':')[0];
      if (!fileGroups[file]) fileGroups[file] = [];
      fileGroups[file].push(line);
    });
    
    // Check which files we already fixed
    const fixedFiles = [
      'src/intelligence/dataCollectionEngine.ts',
      'src/intelligence/enhancedMetricsCollector.ts'
    ];
    
    console.log('\n   📊 Files with "|| 0" patterns:\n');
    
    Object.entries(fileGroups).forEach(([file, instances]) => {
      const isFixed = fixedFiles.includes(file);
      const status = isFixed ? '✅ FIXED' : '⚠️ NEEDS_REVIEW';
      console.log(`      ${status} ${file} (${instances.length} instances)`);
      
      if (isFixed) {
        report.files_already_fixed.push(file);
      } else {
        report.files_to_fix.push({ file, pattern: '|| 0', instances: instances.length });
      }
      
      // Show first example
      if (!isFixed && instances.length > 0) {
        const example = instances[0].split(':').slice(1).join(':').trim();
        console.log(`         Example: ${example.substring(0, 80)}...`);
      }
    });
    
    report.patterns_found.default_zero = lines.length;
  } else {
    console.log('   ✅ No "|| 0" patterns found in metrics code!');
    report.patterns_found.default_zero = 0;
  }
} catch (error) {
  if (error.status === 1) {
    console.log('   ✅ No "|| 0" patterns found in metrics code!');
    report.patterns_found.default_zero = 0;
  } else {
    console.error('   ❌ Error searching:', error.message);
  }
}

console.log('\n');

// ═══════════════════════════════════════════════════════════
// PATTERN 2: Math.random() for fake data
// ═══════════════════════════════════════════════════════════
console.log('🔍 PATTERN 2: Searching for Math.random() in metrics code...\n');

try {
  const cmd = `grep -r "Math.random()" src/ --include="*.ts" | grep -E "(followers|metrics|engagement)" | grep -v "node_modules" | grep -v "test"`;
  const result = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
  
  if (result) {
    const lines = result.split('\n');
    console.log(`   ⚠️ Found ${lines.length} instances of Math.random() in metrics code`);
    
    const fileGroups = {};
    lines.forEach(line => {
      const file = line.split(':')[0];
      if (!fileGroups[file]) fileGroups[file] = [];
      fileGroups[file].push(line);
    });
    
    const fixedFiles = ['src/intelligence/enhancedMetricsCollector.ts'];
    
    console.log('\n   📊 Files with Math.random():\n');
    Object.entries(fileGroups).forEach(([file, instances]) => {
      const isFixed = fixedFiles.includes(file);
      const status = isFixed ? '✅ FIXED' : '⚠️ NEEDS_REVIEW';
      console.log(`      ${status} ${file} (${instances.length} instances)`);
      
      if (!isFixed) {
        const existing = report.files_to_fix.find(f => f.file === file);
        if (existing) {
          existing.patterns = (existing.patterns || []).concat('Math.random()');
        } else {
          report.files_to_fix.push({ file, pattern: 'Math.random()', instances: instances.length });
        }
      }
    });
    
    report.patterns_found.math_random = lines.length;
  } else {
    console.log('   ✅ No Math.random() found in metrics code!');
    report.patterns_found.math_random = 0;
  }
} catch (error) {
  if (error.status === 1) {
    console.log('   ✅ No Math.random() found in metrics code!');
    report.patterns_found.math_random = 0;
  } else {
    console.error('   ❌ Error searching:', error.message);
  }
}

console.log('\n');

// ═══════════════════════════════════════════════════════════
// PATTERN 3: Database inserts/upserts
// ═══════════════════════════════════════════════════════════
console.log('🔍 PATTERN 3: Checking database write operations...\n');

try {
  const cmd = `grep -r "insert\\|upsert" src/ --include="*.ts" | grep -E "(outcomes|metrics|comprehensive)" | grep -v "node_modules" | wc -l`;
  const count = parseInt(execSync(cmd, { encoding: 'utf8' }).trim());
  
  console.log(`   Found ${count} database write operations to metrics tables`);
  console.log('   ℹ️ These should all use null for missing data, not 0');
  
  report.patterns_found.database_writes = count;
} catch (error) {
  console.error('   ❌ Error searching:', error.message);
}

console.log('\n');

// ═══════════════════════════════════════════════════════════
// PATTERN 4: Mock/Fake/Default keywords
// ═══════════════════════════════════════════════════════════
console.log('🔍 PATTERN 4: Searching for mock/fake data keywords...\n');

try {
  const keywords = ['mock data', 'fake data', 'default metrics', 'simulated'];
  let totalFound = 0;
  
  keywords.forEach(keyword => {
    try {
      const cmd = `grep -ri "${keyword}" src/ --include="*.ts" | grep -v "node_modules" | grep -v "test" | wc -l`;
      const count = parseInt(execSync(cmd, { encoding: 'utf8' }).trim());
      if (count > 0) {
        console.log(`   ⚠️ "${keyword}": ${count} references`);
        totalFound += count;
      }
    } catch (e) {
      // Keyword not found
    }
  });
  
  if (totalFound === 0) {
    console.log('   ✅ No mock/fake data keywords found!');
  }
  
  report.patterns_found.mock_keywords = totalFound;
} catch (error) {
  console.error('   ❌ Error searching:', error.message);
}

console.log('\n');

// ═══════════════════════════════════════════════════════════
// GENERATE REPORT
// ═══════════════════════════════════════════════════════════
console.log('════════════════════════════════════════════════════════════');
console.log('📋 CODE AUDIT REPORT');
console.log('════════════════════════════════════════════════════════════\n');

console.log('📊 PATTERNS FOUND:');
console.log(`   "|| 0" defaults: ${report.patterns_found.default_zero || 0}`);
console.log(`   Math.random(): ${report.patterns_found.math_random || 0}`);
console.log(`   Database writes: ${report.patterns_found.database_writes || 0}`);
console.log(`   Mock keywords: ${report.patterns_found.mock_keywords || 0}`);
console.log('');

console.log('✅ FILES ALREADY FIXED:');
if (report.files_already_fixed.length > 0) {
  report.files_already_fixed.forEach(file => {
    console.log(`   ✅ ${file}`);
  });
} else {
  console.log('   (none - all files clean or need review)');
}
console.log('');

console.log('⚠️ FILES NEEDING REVIEW:');
if (report.files_to_fix.length > 0) {
  const uniqueFiles = [...new Set(report.files_to_fix.map(f => f.file))];
  uniqueFiles.forEach(file => {
    const issues = report.files_to_fix.filter(f => f.file === file);
    const patterns = issues.map(i => i.pattern).join(', ');
    console.log(`   ⚠️ ${file}`);
    console.log(`      Patterns: ${patterns}`);
  });
  console.log(`\n   Total: ${uniqueFiles.length} files need review`);
} else {
  console.log('   ✅ No files need review - all clean!');
}
console.log('');

// Assess severity
const totalIssues = report.files_to_fix.length;
let severity, action;

if (totalIssues === 0) {
  severity = '✅ EXCELLENT';
  action = 'Monitor new code only';
  report.severity = 'clean';
} else if (totalIssues <= 3) {
  severity = '⚠️ MINOR';
  action = 'Review and fix if needed';
  report.severity = 'minor';
} else if (totalIssues <= 10) {
  severity = '⚠️ MODERATE';
  action = 'Fix high-priority files';
  report.severity = 'moderate';
} else {
  severity = '❌ HIGH';
  action = 'Systematic cleanup required';
  report.severity = 'high';
}

console.log('🚨 SEVERITY ASSESSMENT:');
console.log(`   Status: ${severity}`);
console.log(`   Files to review: ${totalIssues}`);
console.log(`   Recommended action: ${action}`);
console.log('');

console.log('📝 RECOMMENDATIONS:');
if (totalIssues === 0) {
  console.log('   1. ✅ Code is clean - fixes are complete');
  console.log('   2. 📊 Focus on monitoring new posts');
  console.log('   3. 🔍 Re-audit in 1 week to ensure quality');
} else {
  console.log('   1. Review flagged files for actual fake data risk');
  console.log('   2. Many "|| 0" might be safe (non-metrics usage)');
  console.log('   3. Focus on files that write to outcomes/metrics tables');
  console.log('   4. Prioritize files with Math.random() in metrics');
}
console.log('');

console.log('════════════════════════════════════════════════════════════');
console.log('✅ PHASE 2 CODE AUDIT COMPLETE');
console.log('════════════════════════════════════════════════════════════');

// Save report
const reportPath = './code_audit_report_' + Date.now() + '.json';
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 Detailed report saved to: ${reportPath}`);

