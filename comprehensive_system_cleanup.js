#!/usr/bin/env node

/**
 * 🚀 COMPREHENSIVE SYSTEM CLEANUP - ENTERPRISE GRADE
 * 
 * PURPOSE: Complete cleanup of redundant systems and files
 * - Remove 150+ emergency fix files
 * - Consolidate duplicate agents
 * - Clean up conflicting configurations
 * - Organize codebase structure
 * - Restore operational state
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 ===== COMPREHENSIVE SYSTEM CLEANUP STARTING =====');
console.log('🎯 Target: Remove redundant systems and restore operational state');
console.log('📊 Scope: 150+ emergency files, duplicate agents, conflicting configs');
console.log('');

// ============================================================================
// 1. IDENTIFY FILES AND SYSTEMS TO REMOVE
// ============================================================================

const filesToRemove = [
  // Emergency fix files (move to archive)
  'emergency_*.js',
  'emergency_*.sql',
  'emergency_*.md',
  'EMERGENCY_*.js',
  'EMERGENCY_*.sql', 
  'EMERGENCY_*.md',
  'EMERGENCY_*.ts',
  
  // Duplicate posting agents
  'activate_*.js',
  'apply_*.js',
  'bulletproof_*.js',
  'comprehensive_*.js',
  'deploy_*.js',
  'diagnose_*.js',
  'direct_*.js',
  
  // Temporary and test files
  'temp_*.js',
  'test_*.js',
  'corrected_*.js',
  'fixed_*.js',
  
  // Duplicate SQL files
  'add_*.sql',
  'create_*.sql',
  'check_*.sql',
  'fix_*.sql',
  'setup_*.sql',
  'bulletproof_*.sql',
  'complete_*.sql',
  
  // Configuration conflicts
  'bot_status_*.md',
  'system_*.md',
  'deployment_*.md',
  'autonomous_*.json',
  'master_*.json'
];

const agentsToConsolidate = {
  // Keep only the best posting agent
  posting: {
    keep: ['src/agents/autonomousTwitterPoster.ts'],
    remove: [
      'src/agents/streamlinedPostAgent.ts',
      'src/agents/quickPostModeAgent.ts',
      'src/agents/supremeAIOrchestrator.ts',
      'src/agents/strategist.ts',
      'src/agents/superStrategist.ts'
    ]
  },
  
  // Keep only the best content generators
  content: {
    keep: ['src/agents/intelligentContentGenerator.ts', 'src/agents/viralThreadGenerator.ts'],
    remove: [
      'src/agents/viralContentAgent.ts',
      'src/agents/creativeContentAgent.ts',
      'src/agents/comprehensiveContentAgent.ts',
      'src/agents/diversePerspectiveEngine.ts',
      'src/agents/contentGenerationHub.ts'
    ]
  },
  
  // Keep only the best viral system
  viral: {
    keep: ['src/agents/viralThreadGenerator.ts'],
    remove: [
      'src/agents/viralThemeEngine.ts',
      'src/agents/viralHealthThemeAgent.ts',
      'src/agents/addictionViralEngine.ts',
      'src/agents/addictionIntegrationAgent.ts'
    ]
  },
  
  // Keep only essential learning agents
  learning: {
    keep: ['src/intelligence/followerGrowthOptimizer.ts'],
    remove: [
      'src/agents/adaptiveContentLearner.ts',
      'src/agents/learningAgent.ts',
      'src/agents/learnAgent.ts',
      'src/agents/competitiveIntelligenceLearner.ts',
      'src/agents/crossIndustryLearningAgent.ts',
      'src/agents/nuclearLearningEnhancer.ts',
      'src/agents/strategyLearner.ts',
      'src/agents/engagementFeedbackAgent.ts'
    ]
  },
  
  // Keep only essential engagement system
  engagement: {
    keep: ['src/intelligence/engagementAnalyzer.ts'],
    remove: [
      'src/agents/aggressiveEngagementAgent.ts',
      'src/agents/rateLimitedEngagementAgent.ts',
      'src/agents/engagementMaximizerAgent.ts',
      'src/agents/engagementOptimizer.ts'
    ]
  },
  
  // Keep only essential scheduler
  scheduling: {
    keep: ['src/intelligence/adaptivePostingScheduler.ts'],
    remove: [
      'src/agents/intelligentSchedulingAgent.ts',
      'src/agents/smartPostingScheduler.ts',
      'src/agents/timingOptimizationAgent.ts',
      'src/agents/strategicOpportunityScheduler.ts',
      'src/agents/intelligentPostingDecisionAgent.ts',
      'src/agents/intelligentPostingOptimizerAgent.ts'
    ]
  }
};

// ============================================================================
// 2. CREATE ARCHIVE DIRECTORY
// ============================================================================

function createArchiveDirectory() {
  console.log('📁 Creating archive directory for removed files...');
  
  const archiveDir = path.join(process.cwd(), 'archive_removed_files');
  
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
    console.log(`✅ Created archive directory: ${archiveDir}`);
  } else {
    console.log(`📁 Archive directory already exists: ${archiveDir}`);
  }
  
  return archiveDir;
}

// ============================================================================
// 3. MOVE FILES TO ARCHIVE
// ============================================================================

function moveFilesToArchive(patterns, archiveDir) {
  console.log('📦 Moving redundant files to archive...');
  
  let movedCount = 0;
  const allFiles = getAllFilesRecursively(process.cwd());
  
  patterns.forEach(pattern => {
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    allFiles.forEach(filePath => {
      const fileName = path.basename(filePath);
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Skip files in node_modules, .git, and already archived files
      if (relativePath.includes('node_modules') || 
          relativePath.includes('.git') || 
          relativePath.includes('archive_')) {
        return;
      }
      
      if (regex.test(fileName)) {
        try {
          const archivePath = path.join(archiveDir, relativePath);
          const archiveFileDir = path.dirname(archivePath);
          
          // Create directory structure in archive
          if (!fs.existsSync(archiveFileDir)) {
            fs.mkdirSync(archiveFileDir, { recursive: true });
          }
          
          // Move file to archive
          fs.renameSync(filePath, archivePath);
          console.log(`📦 Archived: ${relativePath}`);
          movedCount++;
          
        } catch (error) {
          console.warn(`⚠️ Could not archive ${relativePath}: ${error.message}`);
        }
      }
    });
  });
  
  console.log(`✅ Archived ${movedCount} redundant files`);
  return movedCount;
}

// ============================================================================
// 4. CONSOLIDATE DUPLICATE AGENTS
// ============================================================================

function consolidateAgents(agentConfig, archiveDir) {
  console.log('🤖 Consolidating duplicate agents...');
  
  let consolidatedCount = 0;
  
  Object.entries(agentConfig).forEach(([category, config]) => {
    console.log(`📂 Processing ${category} agents...`);
    
    // Keep track of what we're keeping
    config.keep.forEach(keepFile => {
      if (fs.existsSync(keepFile)) {
        console.log(`✅ Keeping: ${keepFile}`);
      } else {
        console.warn(`⚠️ Keep file not found: ${keepFile}`);
      }
    });
    
    // Remove duplicate agents
    config.remove.forEach(removeFile => {
      if (fs.existsSync(removeFile)) {
        try {
          const archivePath = path.join(archiveDir, 'duplicate_agents', removeFile);
          const archiveFileDir = path.dirname(archivePath);
          
          if (!fs.existsSync(archiveFileDir)) {
            fs.mkdirSync(archiveFileDir, { recursive: true });
          }
          
          fs.renameSync(removeFile, archivePath);
          console.log(`🗑️ Removed duplicate: ${removeFile}`);
          consolidatedCount++;
          
        } catch (error) {
          console.warn(`⚠️ Could not remove ${removeFile}: ${error.message}`);
        }
      }
    });
  });
  
  console.log(`✅ Consolidated ${consolidatedCount} duplicate agents`);
  return consolidatedCount;
}

// ============================================================================
// 5. CLEAN UP CONFLICTING CONFIGURATIONS
// ============================================================================

function cleanupConfigurations() {
  console.log('⚙️ Cleaning up conflicting configurations...');
  
  const configsToRemove = [
    'autonomous_database_config.json',
    'bulletproof_database_config.json',
    'emergency_deployment_memory.json',
    'deployment_health_check.json'
  ];
  
  let cleanedCount = 0;
  
  configsToRemove.forEach(configFile => {
    if (fs.existsSync(configFile)) {
      try {
        fs.unlinkSync(configFile);
        console.log(`🗑️ Removed conflicting config: ${configFile}`);
        cleanedCount++;
      } catch (error) {
        console.warn(`⚠️ Could not remove ${configFile}: ${error.message}`);
      }
    }
  });
  
  console.log(`✅ Cleaned ${cleanedCount} conflicting configurations`);
  return cleanedCount;
}

// ============================================================================
// 6. UPDATE PACKAGE.JSON AND REMOVE UNUSED DEPENDENCIES
// ============================================================================

function cleanupPackageJson() {
  console.log('📦 Cleaning up package.json...');
  
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) {
      console.warn('⚠️ package.json not found');
      return;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Remove emergency scripts
    const scriptsToRemove = [
      'emergency-post',
      'emergency-fix',
      'emergency-reset',
      'emergency-mode',
      'bulletproof-start',
      'deploy-emergency'
    ];
    
    let removedScripts = 0;
    scriptsToRemove.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        delete packageJson.scripts[script];
        removedScripts++;
        console.log(`🗑️ Removed emergency script: ${script}`);
      }
    });
    
    // Add essential scripts if missing
    const essentialScripts = {
      'start': 'node src/main.ts',
      'dev': 'nodemon src/main.ts',
      'build': 'tsc',
      'test': 'jest',
      'post-now': 'node src/emergencyMain.ts'
    };
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    Object.entries(essentialScripts).forEach(([name, command]) => {
      if (!packageJson.scripts[name]) {
        packageJson.scripts[name] = command;
        console.log(`✅ Added essential script: ${name}`);
      }
    });
    
    // Write updated package.json
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log(`✅ Updated package.json (removed ${removedScripts} emergency scripts)`);
    
  } catch (error) {
    console.error(`❌ Failed to update package.json: ${error.message}`);
  }
}

// ============================================================================
// 7. CREATE CLEAN ENVIRONMENT CONFIG
// ============================================================================

function createCleanEnvironmentConfig() {
  console.log('🔧 Creating clean environment configuration...');
  
  const cleanEnvExample = `# 🚀 XBOT TWITTER BOT - CLEAN CONFIGURATION
# =====================================================

# Required Twitter API Credentials
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
TWITTER_BEARER_TOKEN=your_bearer_token_here
TWITTER_USER_ID=your_numeric_user_id

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI Configuration
OPENAI_API_KEY=sk-your_openai_api_key_here

# Bot Settings
NODE_ENV=production
DAILY_TWEET_LIMIT=17
DAILY_AI_BUDGET_LIMIT=7.50

# System Settings
USE_SUPABASE_ONLY=false
EMERGENCY_MODE=false
DEBUG_MODE=false
`;

  try {
    fs.writeFileSync('.env.clean', cleanEnvExample);
    console.log('✅ Created clean environment template: .env.clean');
    console.log('📋 Copy this to .env and add your actual credentials');
  } catch (error) {
    console.error(`❌ Failed to create clean environment config: ${error.message}`);
  }
}

// ============================================================================
// 8. GENERATE CLEANUP REPORT
// ============================================================================

function generateCleanupReport(stats) {
  console.log('📊 Generating cleanup report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      filesArchived: stats.filesArchived,
      agentsConsolidated: stats.agentsConsolidated,
      configsCleaned: stats.configsCleaned
    },
    actions: [
      '✅ Archived redundant emergency files',
      '✅ Consolidated duplicate agents',
      '✅ Cleaned conflicting configurations',
      '✅ Updated package.json scripts',
      '✅ Created clean environment template'
    ],
    nextSteps: [
      '1. Run the Supabase database schema fix',
      '2. Update environment variables with Twitter credentials',
      '3. Test Twitter authentication',
      '4. Deploy bot with clean configuration',
      '5. Monitor system health'
    ],
    keptSystems: {
      posting: 'src/agents/autonomousTwitterPoster.ts',
      content: ['src/agents/intelligentContentGenerator.ts', 'src/agents/viralThreadGenerator.ts'],
      engagement: 'src/intelligence/engagementAnalyzer.ts',
      learning: 'src/intelligence/followerGrowthOptimizer.ts',
      scheduling: 'src/intelligence/adaptivePostingScheduler.ts'
    }
  };
  
  fs.writeFileSync('SYSTEM_CLEANUP_REPORT.json', JSON.stringify(report, null, 2));
  console.log('✅ Generated cleanup report: SYSTEM_CLEANUP_REPORT.json');
  
  return report;
}

// ============================================================================
// 9. UTILITY FUNCTIONS
// ============================================================================

function getAllFilesRecursively(dir) {
  let files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip certain directories
        if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
          files = files.concat(getAllFilesRecursively(fullPath));
        }
      } else {
        files.push(fullPath);
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
  }
  
  return files;
}

// ============================================================================
// 10. MAIN EXECUTION
// ============================================================================

async function runComprehensiveCleanup() {
  try {
    console.log('🚀 Starting comprehensive system cleanup...');
    console.log('');
    
    // Create archive directory
    const archiveDir = createArchiveDirectory();
    
    // Move redundant files to archive
    const filesArchived = moveFilesToArchive(filesToRemove, archiveDir);
    
    // Consolidate duplicate agents
    const agentsConsolidated = consolidateAgents(agentsToConsolidate, archiveDir);
    
    // Clean up configurations
    const configsCleaned = cleanupConfigurations();
    
    // Update package.json
    cleanupPackageJson();
    
    // Create clean environment config
    createCleanEnvironmentConfig();
    
    // Generate report
    const stats = { filesArchived, agentsConsolidated, configsCleaned };
    const report = generateCleanupReport(stats);
    
    console.log('');
    console.log('🎉 ===== COMPREHENSIVE SYSTEM CLEANUP COMPLETED =====');
    console.log('');
    console.log('📊 CLEANUP STATISTICS:');
    console.log(`   📦 Files archived: ${stats.filesArchived}`);
    console.log(`   🤖 Agents consolidated: ${stats.agentsConsolidated}`);
    console.log(`   ⚙️ Configs cleaned: ${stats.configsCleaned}`);
    console.log('');
    console.log('✅ SYSTEMS RETAINED:');
    console.log('   🤖 Autonomous Twitter Poster (main agent)');
    console.log('   🧠 Intelligent Content Generator');
    console.log('   🔥 Viral Thread Generator');
    console.log('   📊 Engagement Analyzer');
    console.log('   🎯 Follower Growth Optimizer');
    console.log('   📅 Adaptive Posting Scheduler');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('   1. 🗄️ Run SUPABASE_COMPATIBLE_DATABASE_SCHEMA_FIX.sql');
    console.log('   2. 🔐 Update environment variables with Twitter credentials');
    console.log('   3. 🐦 Test Twitter authentication');
    console.log('   4. 🚀 Deploy bot with clean configuration');
    console.log('   5. 📊 Monitor system health');
    console.log('');
    console.log('🚀 Your bot is now cleaned up and ready for operation!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
if (require.main === module) {
  runComprehensiveCleanup();
}

module.exports = {
  runComprehensiveCleanup,
  createArchiveDirectory,
  moveFilesToArchive,
  consolidateAgents,
  cleanupConfigurations
};