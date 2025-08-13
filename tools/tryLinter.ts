#!/usr/bin/env ts-node
import { lintAndSplitThread } from '../src/utils/tweetLinter';

async function main() {
  let input = '';
  
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  
  try {
    const rawTweets = JSON.parse(input.trim());
    const { tweets, reasons } = lintAndSplitThread(rawTweets);
    
    console.log('=== LINTED TWEETS ===');
    tweets.forEach((tweet, i) => console.log(`${i + 1}: ${tweet}`));
    console.log('\n=== FIXES APPLIED ===');
    reasons.forEach(reason => console.log(`- ${reason}`));
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();