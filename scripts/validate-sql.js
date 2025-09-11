// scripts/validate-sql.js - Validate all SQL migrations for syntax and structure
const fs = require('fs');
const path = require('path');

function validateSQL(filename, content) {
  const issues = [];
  
  // Check for basic SQL structure
  if (!content.trim()) {
    issues.push('Empty file');
    return issues;
  }
  
  // Check for dangerous operations
  if (content.includes('DROP TABLE ') && !content.includes('IF EXISTS')) {
    issues.push('DROP TABLE without IF EXISTS - not idempotent');
  }
  
  // Check for CREATE TABLE idempotency
  const createTables = content.match(/CREATE TABLE\s+(\w+)/gi);
  if (createTables) {
    createTables.forEach(match => {
      if (!content.includes('CREATE TABLE IF NOT EXISTS')) {
        issues.push(`CREATE TABLE should use IF NOT EXISTS for idempotency`);
      }
    });
  }
  
  // Check for index idempotency
  const createIndexes = content.match(/CREATE INDEX\s+(\w+)/gi);
  if (createIndexes) {
    createIndexes.forEach(match => {
      if (!content.includes('CREATE INDEX IF NOT EXISTS')) {
        issues.push(`CREATE INDEX should use IF NOT EXISTS for idempotency`);
      }
    });
  }
  
  // Check for transaction safety
  if (content.includes('BEGIN') && !content.includes('COMMIT')) {
    issues.push('Has BEGIN but no COMMIT - transaction not closed');
  }
  
  // Check for RLS policies
  if (content.includes('CREATE TABLE') && content.includes('public.')) {
    if (!content.includes('ENABLE ROW LEVEL SECURITY')) {
      issues.push('Public table created without RLS consideration');
    }
  }
  
  return issues;
}

function validateMigrations() {
  console.log('🔍 Validating SQL Migration Files');
  console.log('==================================');
  
  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('❌ Migrations directory not found');
    return false;
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  console.log(`📊 Found ${files.length} migration files`);
  
  let totalIssues = 0;
  let validFiles = 0;
  
  files.forEach(file => {
    const filepath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filepath, 'utf8');
    const issues = validateSQL(file, content);
    
    if (issues.length === 0) {
      console.log(`✅ ${file}: Valid`);
      validFiles++;
    } else {
      console.log(`⚠️  ${file}: ${issues.length} issues`);
      issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
      totalIssues += issues.length;
    }
  });
  
  console.log('');
  console.log('==================================');
  console.log(`📊 Summary: ${validFiles}/${files.length} files valid`);
  console.log(`⚠️  Total issues: ${totalIssues}`);
  
  // Check specific critical files
  const criticalFiles = [
    '20250911_0100_api_usage_uuid.sql',
    '20250911_0200_xbot_content_brain.sql'
  ];
  
  console.log('');
  console.log('🎯 Critical Files Check:');
  criticalFiles.forEach(file => {
    if (files.includes(file)) {
      console.log(`✅ ${file}: Present`);
    } else {
      console.log(`❌ ${file}: Missing`);
    }
  });
  
  return totalIssues === 0;
}

// Run validation
const allValid = validateMigrations();
process.exit(allValid ? 0 : 1);
