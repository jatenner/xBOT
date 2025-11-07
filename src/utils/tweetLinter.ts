import { FinalFormat } from './formatSanitizer';

export interface LintResult {
  tweets: string[];
  reasons: string[];
}

// Environment variable defaults (read at function call time for testing flexibility)
function getTweetMaxCharsHard(): number {
  return parseInt(process.env.TWEET_MAX_CHARS_HARD || '279');
}

function getEmojiMax(): number {
  return parseInt(process.env.EMOJI_MAX || '2');
}

function getForceNoHashtags(): boolean {
  return process.env.FORCE_NO_HASHTAGS === 'true';
}

export function lintAndSplitThread(rawTweets: string[], finalFormat: FinalFormat = 'thread'): LintResult {
  // Strict validation: only accept arrays
  if (!Array.isArray(rawTweets)) {
    throw new Error('LINTER_INPUT_MUST_BE_ARRAY: Input must be an array of tweets');
  }

  if (rawTweets.length === 0) {
    throw new Error('NO_TWEETS_ARRAY_ABORT: Empty tweets array provided');
  }

  const tweets: string[] = [];
  const reasons: string[] = [];
  
  for (let i = 0; i < rawTweets.length; i++) {
    let content = rawTweets[i].trim();
    
    const TWEET_MAX_CHARS_HARD = getTweetMaxCharsHard();
    const EMOJI_MAX = getEmojiMax();
    
    // Apply different length limits based on format and position
    let maxLength: number;
    if (finalFormat === 'single' || finalFormat === 'longform_single') {
      maxLength = TWEET_MAX_CHARS_HARD; // 279 for singles
    } else {
      // Thread tweets: 240 for T1 (before-the-fold), 270 for T2+
      maxLength = i === 0 ? 240 : 270;
    }
    
    // Reject outright if content exceeds limit — no silent trimming
    if (content.length > maxLength) {
      throw new Error(`THREAD_ABORT_LINT_FAIL: Tweet ${i + 1} exceeds ${maxLength} chars (${content.length})`);
    }
    
    // Count emojis and limit to EMOJI_MAX
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount > EMOJI_MAX) {
      // Only reduce emojis if above cap, never remove emojis inside bullets/parentheticals
      const beforeEmoji = content;
      content = limitEmojis(content, EMOJI_MAX);
      if (content !== beforeEmoji) {
        reasons.push(`emoji_reduce`);
      }
    }
    
    tweets.push(content);
  }
  
  // Handle hashtags based on FORCE_NO_HASHTAGS setting
  const FORCE_NO_HASHTAGS = getForceNoHashtags();
  if (FORCE_NO_HASHTAGS) {
    // Strip all hashtags when FORCE_NO_HASHTAGS=true
    let hashtagsRemoved = false;
    for (let i = 0; i < tweets.length; i++) {
      const beforeHashtag = tweets[i];
      tweets[i] = tweets[i].replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
      if (tweets[i] !== beforeHashtag) {
        hashtagsRemoved = true;
      }
    }
    if (hashtagsRemoved) {
      reasons.push('hashtags_removed');
    }
  }
  // If FORCE_NO_HASHTAGS is false, we leave hashtags alone entirely
  
  // Final validation
  if (tweets.length === 0) {
    throw new Error('THREAD_ABORT_LINT_FAIL: All tweets were filtered out during linting');
  }

  // Validate each tweet length based on format
  const TWEET_MAX_CHARS_HARD = getTweetMaxCharsHard();
  for (let i = 0; i < tweets.length; i++) {
    let maxLength: number;
    if (finalFormat === 'single' || finalFormat === 'longform_single') {
      maxLength = TWEET_MAX_CHARS_HARD;
    } else {
      maxLength = i === 0 ? 240 : 270;
    }
    
    if (tweets[i].length > maxLength) {
      throw new Error(`THREAD_ABORT_LINT_FAIL: Tweet ${i + 1} still exceeds ${maxLength} chars after linting (${tweets[i].length})`);
    }
    if (!tweets[i].trim()) {
      throw new Error(`THREAD_ABORT_LINT_FAIL: Tweet ${i + 1} is empty after linting`);
    }
  }

  // Emit concise one-liner log
  const actionsStr = reasons.length > 0 ? reasons.join('|') : 'none';
  const t1Length = tweets.length > 0 ? tweets[0].length : 0;
  console.log(`LINTER: format=${finalFormat}, tweets=${tweets.length}, t1_chars=${t1Length}, actions=[${actionsStr}]`);

  return { tweets, reasons };
}

function limitEmojis(text: string, maxCount: number = getEmojiMax()): string {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
  const emojis = text.match(emojiRegex) || [];
  
  if (emojis.length <= maxCount) return text;
  
  let result = text;
  for (let i = maxCount; i < emojis.length; i++) {
    result = result.replace(emojis[i], '');
  }
  
  return result.replace(/\s+/g, ' ').trim();
}