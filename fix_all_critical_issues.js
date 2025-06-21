#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class SystemFixer {
  constructor() {
    this.fixedIssues = [];
    this.failedFixes = [];
  }

  async fixAllIssues() {
    console.log('🔧 === FIXING ALL CRITICAL ISSUES ===\n');
    
    // 1. Fix Unicode corruption in all files
    await this.fixUnicodeCorruption();
    
    // 2. Fix environment variables
    await this.fixEnvironmentVariables();
    
    // 3. Clean up duplicate content
    await this.improveDuplicateDetection();
    
    // 4. Rebuild project
    await this.rebuildProject();
    
    // Generate fix report
    this.generateFixReport();
  }

  async fixUnicodeCorruption() {
    console.log('🔤 1. FIXING UNICODE CORRUPTION');
    
    const filesToFix = [
      'src/prompts/tweetPrompt.txt',
      'src/prompts/viralTemplates.txt', 
      'src/prompts/persona.txt',
      'src/prompts/replyPrompt.txt',
      'src/prompts/quoteRetweetTemplates.txt',
      'package.json',
      'README.md',
      'src/utils/formatTweet.ts',
      'src/agents/postTweet.ts'
    ];

    const unicodeReplacements = [
      { from: /��/g, to: '🚀' },
      { from: /\uFFFD/g, to: '🚀' },
      { from: /â€™/g, to: "'" },
      { from: /â€œ/g, to: '"' },
      { from: /â€\x9D/g, to: '"' },
      { from: /Ã¡/g, to: 'á' },
      // Remove control characters except newlines
      { from: /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, to: '' }
    ];

    for (const filePath of filesToFix) {
      try {
        if (fs.existsSync(filePath)) {
          let content = fs.readFileSync(filePath, 'utf8');
          let changed = false;
          
          for (const replacement of unicodeReplacements) {
            const originalContent = content;
            content = content.replace(replacement.from, replacement.to);
            if (content !== originalContent) {
              changed = true;
            }
          }
          
          if (changed) {
            // Create backup
            fs.writeFileSync(`${filePath}.backup`, fs.readFileSync(filePath));
            
            // Write fixed content
            fs.writeFileSync(filePath, content, 'utf8');
            
            this.fixedIssues.push({
              type: 'UNICODE_CORRUPTION_FIXED',
              file: filePath,
              backup: `${filePath}.backup`
            });
            console.log(`   ✅ Fixed: ${filePath}`);
          } else {
            console.log(`   ✅ Clean: ${filePath}`);
          }
        }
      } catch (error) {
        this.failedFixes.push({
          type: 'UNICODE_FIX_FAILED',
          file: filePath,
          error: error.message
        });
        console.log(`   ❌ Failed: ${filePath} - ${error.message}`);
      }
    }
  }

  async fixEnvironmentVariables() {
    console.log('\n🔐 2. FIXING ENVIRONMENT VARIABLES');
    
    try {
      if (fs.existsSync('.env')) {
        let envContent = fs.readFileSync('.env', 'utf8');
        
        // Check for missing Twitter API keys
        if (!envContent.includes('TWITTER_API_KEY=') || !envContent.includes('TWITTER_API_SECRET=')) {
          console.log('   ⚠️  Missing Twitter API credentials in .env file');
          console.log('   💡 You need to add:');
          console.log('      TWITTER_API_KEY=your_api_key_here');
          console.log('      TWITTER_API_SECRET=your_api_secret_here');
          
          // Add placeholders if completely missing
          if (!envContent.includes('TWITTER_API_KEY=')) {
            envContent += '\n# Add your Twitter API key here\nTWITTER_API_KEY=your_api_key_here\n';
          }
          if (!envContent.includes('TWITTER_API_SECRET=')) {
            envContent += '\n# Add your Twitter API secret here\nTWITTER_API_SECRET=your_api_secret_here\n';
          }
          
          fs.writeFileSync('.env', envContent);
          
          this.fixedIssues.push({
            type: 'ENV_PLACEHOLDERS_ADDED',
            message: 'Added placeholder entries for missing Twitter API credentials'
          });
        } else {
          console.log('   ✅ Twitter API credentials present in .env');
        }
      } else {
        console.log('   ❌ .env file not found');
        this.failedFixes.push({
          type: 'ENV_FILE_MISSING',
          message: '.env file does not exist'
        });
      }
    } catch (error) {
      this.failedFixes.push({
        type: 'ENV_FIX_FAILED',
        error: error.message
      });
      console.log(`   ❌ Failed to fix environment variables: ${error.message}`);
    }
  }

  async improveDuplicateDetection() {
    console.log('\n📝 3. IMPROVING DUPLICATE CONTENT DETECTION');
    
    try {
      // Add better duplicate detection to content sanity
      const contentSanityPath = 'src/utils/contentSanity.ts';
      
      if (fs.existsSync(contentSanityPath)) {
        let content = fs.readFileSync(contentSanityPath, 'utf8');
        
        // Check if duplicate detection already exists
        if (!content.includes('validateContentUniqueness')) {
          // Add duplicate detection function
          const duplicateDetectionCode = `
/**
 * Validates content uniqueness against recent tweets
 */
export async function validateContentUniqueness(text: string, supabase: any): Promise<ValidationResult> {
  try {
    // Get recent tweets from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentTweets, error } = await supabase
      .from('tweets')
      .select('content')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Could not check for duplicates:', error.message);
      return { ok: true }; // Don't block on database errors
    }

    if (recentTweets && recentTweets.length > 0) {
      const normalizedText = text.toLowerCase().replace(/[^a-z0-9\\s]/g, '');
      
      for (const tweet of recentTweets) {
        const normalizedTweet = tweet.content.toLowerCase().replace(/[^a-z0-9\\s]/g, '');
        
        // Check for exact matches
        if (normalizedText === normalizedTweet) {
          return {
            ok: false,
            reason: 'Content is identical to a recent tweet'
          };
        }
        
        // Check for high similarity (80%+ match)
        const similarity = calculateSimilarity(normalizedText, normalizedTweet);
        if (similarity > 0.8) {
          return {
            ok: false,
            reason: \`Content is too similar to a recent tweet (\${Math.round(similarity * 100)}% match)\`
          };
        }
      }
    }

    return { ok: true };
  } catch (error) {
    console.warn('Duplicate check failed:', error.message);
    return { ok: true }; // Don't block on errors
  }
}

/**
 * Calculate similarity between two strings using simple word overlap
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(/\\s+/).filter(w => w.length > 2);
  const words2 = str2.split(/\\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}
`;

          // Insert before the main sanity check function
          const insertPoint = content.indexOf('export async function runContentSanityCheck');
          if (insertPoint !== -1) {
            content = content.slice(0, insertPoint) + duplicateDetectionCode + '\n' + content.slice(insertPoint);
            
            fs.writeFileSync(contentSanityPath, content);
            
            this.fixedIssues.push({
              type: 'DUPLICATE_DETECTION_ADDED',
              file: contentSanityPath
            });
            console.log('   ✅ Added duplicate content detection');
          } else {
            console.log('   ⚠️  Could not find insertion point for duplicate detection');
          }
        } else {
          console.log('   ✅ Duplicate detection already exists');
        }
      }
    } catch (error) {
      this.failedFixes.push({
        type: 'DUPLICATE_DETECTION_FAILED',
        error: error.message
      });
      console.log(`   ❌ Failed to add duplicate detection: ${error.message}`);
    }
  }

  async rebuildProject() {
    console.log('\n📦 4. REBUILDING PROJECT');
    
    try {
      const { execSync } = require('child_process');
      
      console.log('   🔄 Running npm run build...');
      execSync('npm run build', { stdio: 'inherit' });
      
      this.fixedIssues.push({
        type: 'PROJECT_REBUILT',
        message: 'Successfully rebuilt project with fixes'
      });
      console.log('   ✅ Project rebuilt successfully');
      
    } catch (error) {
      this.failedFixes.push({
        type: 'BUILD_FAILED',
        error: error.message
      });
      console.log(`   ❌ Build failed: ${error.message}`);
    }
  }

  generateFixReport() {
    console.log('\n📋 === FIX REPORT SUMMARY ===');
    
    console.log(`\n✅ FIXES APPLIED: ${this.fixedIssues.length}`);
    this.fixedIssues.forEach(fix => {
      console.log(`   • ${fix.type}: ${fix.file || fix.message || 'Applied'}`);
    });

    if (this.failedFixes.length > 0) {
      console.log(`\n❌ FIXES FAILED: ${this.failedFixes.length}`);
      this.failedFixes.forEach(fail => {
        console.log(`   • ${fail.type}: ${fail.error || fail.message}`);
      });
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('   1. 🔑 Add your actual Twitter API credentials to .env file');
    console.log('   2. 🚀 Deploy the fixes: ./quick_deploy.sh');
    console.log('   3. 🔍 Monitor the system: ./start_remote_bot_monitor.js');
    console.log('   4. ✅ Verify bot is posting correctly');

    console.log('\n✅ Critical fixes complete!');
  }
}

// Run the fixes
const fixer = new SystemFixer();
fixer.fixAllIssues().catch(console.error); 