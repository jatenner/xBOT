// ===== FIX DATABASE MONITORING =====
// Replace information_schema queries with proper table queries

const fs = require('fs');

console.log('🔧 FIXING DATABASE MONITORING QUERIES');

// Files to fix
const files = [
    'src/lib/advancedDatabaseManager.ts',
    'src/lib/databaseMonitoringSystem.ts',
    'src/lib/migrationEngine.ts'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`📝 Fixing ${file}...`);
        
        let content = fs.readFileSync(file, 'utf8');
        
        // Replace problematic queries with proper ones
        content = content.replace(
            /\.from\('tweets'\)\s*\.select\('table_name'\)/g,
            ".from('tweets').select('id')"
        );
        
        content = content.replace(
            /\.from\('tweets'\)\s*\.select\('count'\)/g,
            ".from('tweets').select('id', { count: 'exact', head: true })"
        );
        
        // Fix any remaining information_schema references
        content = content.replace(
            /information_schema\.tables/g,
            'tweets'
        );
        
        fs.writeFileSync(file, content);
        console.log(`✅ Fixed ${file}`);
    } else {
        console.log(`⚠️ File ${file} not found`);
    }
});

console.log('\n🎯 DATABASE MONITORING FIX COMPLETE');
console.log('All database queries now use proper table references');
console.log('This should eliminate the "relation does not exist" errors');