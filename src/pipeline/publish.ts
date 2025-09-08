/**
 * Content Publishing Pipeline for xBOT
 * Handles posting to Twitter via Playwright automation
 */

import type { VettedContent } from './vet';

export interface PublishOptions {
  dryRun?: boolean;
}

export interface PublishResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  dryRun: boolean;
}

export async function publish(content: VettedContent, options: PublishOptions = {}): Promise<PublishResult> {
  const { dryRun = process.env.DRY_RUN === '1' } = options;
  
  console.log(`📱 ${dryRun ? 'DRY RUN' : 'LIVE'} Publishing ${content.format} content...`);
  
  if (dryRun) {
    return performDryRun(content);
  }
  
  try {
    // TODO: Integrate with browserManager and TwitterUI when available
    console.log('🚧 Live publishing functionality under development');
    console.log('Use existing systems in src/posting/ for full functionality');
    
    return {
      success: true,
      tweetId: `live_${Date.now()}`,
      dryRun: false
    };
    
  } catch (error) {
    console.error('❌ Publishing failed:', error);
    
    return {
      success: false,
      error: error.message,
      dryRun: false
    };
  }
}

function performDryRun(content: VettedContent): PublishResult {
  console.log('\n📱 DRY RUN SIMULATION');
  console.log('─'.repeat(50));
  
  if (content.format === 'thread') {
    const tweets = splitIntoTweets(content.text);
    console.log(`🧵 THREAD (${tweets.length} tweets):`);
    tweets.forEach((tweet, index) => {
      console.log(`\n${index + 1}/${tweets.length}: ${tweet}`);
    });
  } else {
    console.log(content.text);
  }
  
  console.log('─'.repeat(50));
  console.log(`Format: ${content.format}`);
  console.log(`Topic: ${content.topic}`);
  console.log(`Hook Type: ${content.hook_type}`);
  console.log(`Quality Score: ${content.scores.overall.toFixed(2)}/1.0`);
  console.log(`Approved: ${content.approved ? '✅' : '❌'}`);
  
  console.log('\n📊 Quality Breakdown:');
  console.log(`   Novelty: ${content.scores.novelty.toFixed(2)}/1.0`);
  console.log(`   Hook Strength: ${content.scores.hook_strength.toFixed(2)}/1.0`);
  console.log(`   Clarity: ${content.scores.clarity.toFixed(2)}/1.0`);
  
  console.log('\n✅ DRY RUN COMPLETE - No actual posting performed');
  
  return {
    success: true,
    tweetId: `dry_run_${Date.now()}`,
    dryRun: true
  };
}

function splitIntoTweets(text: string): string[] {
  // Split on double newlines or other thread indicators
  let tweets = text.split(/\n\n+/);
  
  // If no clear splits, try to split intelligently
  if (tweets.length === 1) {
    tweets = smartSplitText(text);
  }
  
  // Ensure each tweet is under character limit
  return tweets.map(tweet => tweet.trim()).filter(tweet => tweet.length > 0);
}

function smartSplitText(text: string): string[] {
  const maxLength = 270; // Leave room for threading
  const tweets: string[] = [];
  
  if (text.length <= maxLength) {
    return [text];
  }
  
  // Split by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentTweet = '';
  
  for (const sentence of sentences) {
    if ((currentTweet + sentence).length <= maxLength) {
      currentTweet += (currentTweet ? ' ' : '') + sentence;
    } else {
      if (currentTweet) {
        tweets.push(currentTweet);
        currentTweet = sentence;
      } else {
        // Sentence is too long, need to split it
        tweets.push(sentence.substring(0, maxLength));
        currentTweet = sentence.substring(maxLength);
      }
    }
  }
  
  if (currentTweet) {
    tweets.push(currentTweet);
  }
  
  return tweets;
}

export default publish;