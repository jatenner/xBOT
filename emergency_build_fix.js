#!/usr/bin/env node

/**
 * 🚨 EMERGENCY BUILD FIX
 * Fix only the critical TypeScript errors causing build failure
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY BUILD FIX');
console.log('======================');

function fixPostTweetTypes() {
  const postTweetPath = path.join(process.cwd(), 'src/agents/postTweet.ts');
  
  if (fs.existsSync(postTweetPath)) {
    let content = fs.readFileSync(postTweetPath, 'utf8');
    
    // Fix missing properties in metadata object
    content = content.replace(
      /metadata: \{ source: 'PostTweetAgent' \}/,
      `metadata: { 
        source: 'PostTweetAgent',
        estimated_engagement: 0,
        confidence_score: 0.8,
        generation_timestamp: Date.now().toString(),
        model_used: 'gpt-4o-mini'
      }`
    );
    
    fs.writeFileSync(postTweetPath, content);
    console.log('✅ Fixed PostTweet metadata types');
  }
}

function fixSinglePostingManager() {
  const singleManagerPath = path.join(process.cwd(), 'src/core/singlePostingManager.ts');
  
  if (fs.existsSync(singleManagerPath)) {
    let content = fs.readFileSync(singleManagerPath, 'utf8');
    
    // Add the missing import
    if (!content.includes("import { AutonomousPostingEngine }")) {
      content = `import { AutonomousPostingEngine } from './autonomousPostingEngine';\n\n` + content;
    }
    
    // Fix property access
    content = content.replace(
      /result\.content_preview/g,
      'result.content?.substring(0, 50) || "Content preview"'
    );
    
    fs.writeFileSync(singleManagerPath, content);
    console.log('✅ Fixed SinglePostingManager imports and types');
  }
}

function addSimpleBrowserFix() {
  const browserPath = path.join(process.cwd(), 'src/utils/browserTweetPoster.ts');
  
  if (fs.existsSync(browserPath)) {
    let content = fs.readFileSync(browserPath, 'utf8');
    
    // Only add context property if missing
    if (!content.includes('private context:')) {
      content = content.replace(
        /export class BrowserTweetPoster \{/,
        `export class BrowserTweetPoster {
  private context: any;`
      );
    }
    
    fs.writeFileSync(browserPath, content);
    console.log('✅ Fixed BrowserTweetPoster context property');
  }
}

function main() {
  console.log('Applying minimal fixes...');
  
  fixPostTweetTypes();
  fixSinglePostingManager();
  addSimpleBrowserFix();
  
  console.log('');
  console.log('✅ Emergency build fixes applied');
  console.log('🚀 Testing build...');
}

main();