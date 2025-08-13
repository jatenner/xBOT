export interface LintResult {
  tweets: string[];
  reasons: string[];
}

export function lintAndSplitThread(rawTweets: string[]): LintResult {
  const tweets: string[] = [];
  const reasons: string[] = [];
  
  for (let i = 0; i < rawTweets.length; i++) {
    let content = rawTweets[i].trim();
    
    // Hard cap at 260 chars (20 char headroom)
    if (content.length > 260) {
      const truncated = truncateAtWordBoundary(content, 260);
      if (truncated !== content) {
        reasons.push(`Tweet ${i + 1}: truncated from ${content.length} to ${truncated.length} chars`);
        content = truncated;
      }
    }
    
    // Count emojis and limit to 1
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount > 1) {
      content = limitEmojis(content);
      reasons.push(`Tweet ${i + 1}: limited to 1 emoji (had ${emojiCount})`);
    }
    
    tweets.push(content);
  }
  
  // Enforce hashtag rules: max 2 total, none in T1
  let allHashtags = tweets.flatMap(t => t.match(/#\w+/g) || []);
  if (allHashtags.length > 2 || (tweets.length > 0 && tweets[0].includes('#'))) {
    tweets[0] = tweets[0].replace(/#\w+/g, '').trim(); // Remove all hashtags from T1
    
    // Keep only first 2 hashtags in remaining tweets
    let hashtagCount = 0;
    for (let i = 1; i < tweets.length; i++) {
      tweets[i] = tweets[i].replace(/#\w+/g, (match) => {
        if (hashtagCount < 2) {
          hashtagCount++;
          return match;
        }
        return '';
      }).replace(/\s+/g, ' ').trim();
    }
    
    reasons.push(`Enforced hashtag rules: removed from T1, limited to 2 total`);
  }
  
  // Ensure penultimate tweet has "Sources:" if we have multiple tweets
  if (tweets.length >= 3) {
    const sourcesIndex = tweets.length - 2;
    if (!tweets[sourcesIndex].toLowerCase().includes('sources:')) {
      tweets[sourcesIndex] = `Sources: ${tweets[sourcesIndex]}`;
      if (tweets[sourcesIndex].length > 260) {
        tweets[sourcesIndex] = truncateAtWordBoundary(tweets[sourcesIndex], 260);
      }
      reasons.push(`Added "Sources:" to penultimate tweet`);
    }
  }
  
  // Ensure last tweet is CTA format
  if (tweets.length >= 2) {
    const lastIndex = tweets.length - 1;
    if (!tweets[lastIndex].toLowerCase().includes('follow') && !tweets[lastIndex].toLowerCase().includes('cta:')) {
      tweets[lastIndex] = `CTA: ${tweets[lastIndex]}`;
      if (tweets[lastIndex].length > 260) {
        tweets[lastIndex] = truncateAtWordBoundary(tweets[lastIndex], 260);
      }
      reasons.push(`Formatted last tweet as CTA`);
    }
  }
  
  return { tweets, reasons };
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  let truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    truncated = truncated.substring(0, lastSpace);
  } else {
    // If no good word boundary, ensure we don't break mid-word
    truncated = truncated.substring(0, maxLength - 3) + '...';
  }
  
  return truncated.trim();
}

function limitEmojis(text: string): string {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
  const emojis = text.match(emojiRegex) || [];
  
  if (emojis.length <= 1) return text;
  
  let result = text;
  for (let i = 1; i < emojis.length; i++) {
    result = result.replace(emojis[i], '');
  }
  
  return result.replace(/\s+/g, ' ').trim();
}