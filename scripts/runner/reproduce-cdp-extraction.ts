#!/usr/bin/env tsx
/**
 * 🔍 REPRODUCE CDP EXTRACTION
 * Navigate to tweet and dump extracted text for debugging
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}
if (!process.env.RUNNER_BROWSER) {
  process.env.RUNNER_BROWSER = 'cdp';
}

async function reproduceExtraction(tweetId: string) {
  // Clean tweet ID (remove any extra spaces/IDs)
  const cleanTweetId = tweetId.trim().split(/\s+/)[0];
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 REPRODUCING CDP EXTRACTION: ${cleanTweetId}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  const context = await launchRunnerPersistent(true); // headless
  const page = await context.newPage();
  
  const debugDir = path.join(process.env.RUNNER_PROFILE_DIR || '.runner-profile', 'harvest_debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  
  try {
    const tweetUrl = `https://x.com/i/status/${cleanTweetId}`;
    console.log(`🌐 Navigating to ${tweetUrl}...`);
    
    await page.goto(tweetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Wait for tweet article
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000); // Let content stabilize
    
    // Handle "Show more" button
    try {
      const showMoreButton = await page.$('article[data-testid="tweet"] span:has-text("Show more")').catch(() => null);
      if (showMoreButton) {
        console.log('   📖 Clicking "Show more"...');
        await showMoreButton.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      // Ignore
    }
    
    // Extract tweet text using same logic as fetchTweetData
    const extractionResult = await page.evaluate(() => {
      const article = document.querySelector('article[data-testid="tweet"]');
      if (!article) {
        return { error: 'no_article', text: '', method: 'none' };
      }
      
      // Try primary selector first
      const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
      if (tweetTextEl) {
        // Collect all text from spans inside
        const spans = tweetTextEl.querySelectorAll('span');
        const texts: string[] = [];
        spans.forEach(span => {
          const text = span.textContent?.trim();
          if (text && text.length > 0) {
            texts.push(text);
          }
        });
        
        // If we got spans, join them; otherwise use textContent
        if (texts.length > 0) {
          return { 
            text: texts.join(' '), 
            method: 'spans',
            span_count: texts.length,
            textContent_fallback: tweetTextEl.textContent || ''
          };
        }
        return { 
          text: tweetTextEl.textContent || '', 
          method: 'textContent',
          span_count: 0
        };
      }
      
      // Fallback: try to find any text container in article
      const allText = article.textContent || '';
      return { 
        text: allText.substring(0, 500), // Limit to reasonable length
        method: 'article_textContent',
        span_count: 0
      };
    });
    
    const extractedText = extractionResult.text || '';
    const textLength = extractedText.length;
    
    console.log(`\n📊 EXTRACTION RESULT:`);
    console.log(`   Method: ${extractionResult.method || 'unknown'}`);
    console.log(`   Span count: ${extractionResult.span_count || 0}`);
    console.log(`   Text length: ${textLength}`);
    console.log(`   Text (first 280 chars): ${extractedText.substring(0, 280)}`);
    
    if (textLength < 20) {
      console.log(`\n⚠️  TEXT TOO SHORT (< 20 chars) - Saving debug artifacts...`);
      await page.screenshot({ path: path.join(debugDir, `${tweetId}_extraction_failed.png`), fullPage: true });
      const html = await page.content();
      fs.writeFileSync(path.join(debugDir, `${tweetId}_extraction_failed.html`), html);
      console.log(`   ✅ Saved: ${debugDir}/${tweetId}_extraction_failed.png`);
      console.log(`   ✅ Saved: ${debugDir}/${tweetId}_extraction_failed.html`);
    }
    
    // Check for health keywords
    const healthKeywords = [
      'health', 'fitness', 'nutrition', 'wellness', 'exercise', 'diet', 'workout',
      'supplement', 'vitamin', 'protein', 'cardio', 'strength', 'metabolism',
      'cholesterol', 'blood', 'pressure', 'heart', 'muscle', 'weight', 'fat',
      'calorie', 'nutrient', 'immune', 'sleep', 'recovery', 'injury', 'pain',
      'medical', 'doctor', 'patient', 'treatment', 'therapy', 'medication',
      'disease', 'condition', 'symptom', 'diagnosis', 'prevention', 'cure',
      'syndrome', 'cancer', 'diabetes', 'lupus', 'autoimmune', 'clinical', 'trial',
      'symptoms', 'vaccine', 'infection', 'mental health', 'depression',
      'anxiety', 'research', 'study', 'biospecimen', 'collaboration',
    ];
    
    const textLower = extractedText.toLowerCase();
    const matchedKeywords = healthKeywords.filter(kw => textLower.includes(kw.toLowerCase()));
    
    console.log(`\n🔍 HEALTH KEYWORD CHECK:`);
    console.log(`   Matched keywords: ${matchedKeywords.length > 0 ? matchedKeywords.join(', ') : 'none'}`);
    console.log(`   Health score estimate: ${matchedKeywords.length * 5 + (matchedKeywords.length > 0 ? 20 : 0)}`);
    
    await page.close();
    await context.close();
    
    return {
      tweetId: cleanTweetId,
      extractedText,
      textLength,
      method: extractionResult.method,
      matchedKeywords,
      healthScoreEstimate: matchedKeywords.length * 5 + (matchedKeywords.length > 0 ? 20 : 0),
    };
    
  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message}`);
    await page.screenshot({ path: path.join(debugDir, `${cleanTweetId}_error.png`) }).catch(() => {});
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    throw error;
  }
}

async function main() {
  const tweetIds = process.argv.slice(2);
  
  if (tweetIds.length === 0) {
    console.error('Usage: tsx scripts/runner/reproduce-cdp-extraction.ts <tweetId1> [tweetId2] [tweetId3]');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 CDP EXTRACTION REPRODUCTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  for (const tweetId of tweetIds) {
    try {
      await reproduceExtraction(tweetId);
    } catch (error: any) {
      console.error(`Failed to reproduce ${tweetId}: ${error.message}`);
    }
  }
}

main().catch(console.error);
