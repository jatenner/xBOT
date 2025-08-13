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
  const allHashtags = tweets.flatMap(t => t.match(/#\w+/g) || []);
  if (allHashtags.length > 2) {
    tweets[0] = tweets[0].replace(/#\w+/g, '').trim(); // Remove all hashtags from T1
    reasons.push(`Removed hashtags from T1, limited to 2 total hashtags`);
  }
  
  // Add continuation markers for threads
  if (tweets.length > 1) {
    for (let i = 1; i < tweets.length; i++) {
      if (!tweets[i].match(/\(\d+\/\d+\)/)) {
        tweets[i] = `(${i + 1}/${tweets.length}) ${tweets[i]}`;
        if (tweets[i].length > 260) {
          tweets[i] = truncateAtWordBoundary(tweets[i], 260);
        }
      }
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