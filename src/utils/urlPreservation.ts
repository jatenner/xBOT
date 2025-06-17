/**
 * URL Preservation Utility
 * Ensures URLs are NEVER truncated or corrupted in tweet content
 * ENHANCED: Better handling of multiple URLs and content optimization
 */

export function preserveUrlsInTweet(content: string, maxLength: number = 280): string {
  // If content fits, return as-is
  if (content.length <= maxLength) {
    return content;
  }

  console.log(`🔗 URL Preservation: Processing content (${content.length}/${maxLength} chars)`);

  // Extract ALL URLs using comprehensive regex
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = content.match(urlPattern) || [];
  
  if (urls.length === 0) {
    // No URLs to preserve, just truncate normally
    console.log(`📝 No URLs found, using standard truncation`);
    return smartTruncateNoUrls(content, maxLength);
  }

  console.log(`🛡️ Found ${urls.length} URLs to preserve:`, urls);

  // CRITICAL: URLs are SACRED - calculate space requirements
  const primaryUrl = urls[0]; // Always preserve the first URL
  const URL_TWITTER_LENGTH = 23; // Twitter counts URLs as exactly 23 characters
  const SPACE_BEFORE_URL = 1; // One space before URL
  const SAFETY_MARGIN = 3; // Increased safety margin
  
  const urlReservedSpace = URL_TWITTER_LENGTH + SPACE_BEFORE_URL + SAFETY_MARGIN;
  const availableForContent = maxLength - urlReservedSpace;

  console.log(`📐 URL "${primaryUrl}" reserves ${urlReservedSpace} chars, ${availableForContent} available for content`);

  if (availableForContent < 30) {
    // Emergency: Very little space, but URL MUST be preserved
    const emergencyContent = content.split(' ').slice(0, 3).join(' ') + '...';
    const result = `${emergencyContent} ${primaryUrl}`;
    const resultLength = result.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23)).length;
    console.log(`⚠️ Emergency preservation: "${result}" (${resultLength} chars)`);
    return result;
  }

  // Remove URLs from content for processing
  let textContent = content;
  urls.forEach(url => {
    textContent = textContent.replace(url, '').trim();
  });

  // Clean up any double spaces left from URL removal
  textContent = textContent.replace(/\s+/g, ' ').trim();

  // Truncate text content to fit - prioritize complete sentences
  const truncatedText = smartTruncateNoUrls(textContent, availableForContent);
  
  // Reconstruct: text + space + URL
  const finalResult = `${truncatedText.trim()} ${primaryUrl}`;
  
  // Final validation - ensure Twitter character count compliance
  const twitterLength = finalResult.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23)).length;
  
  if (twitterLength > maxLength) {
    console.warn(`⚠️ Final result still too long: ${twitterLength}/${maxLength} chars - applying emergency truncation`);
    // Emergency truncation - cut content more aggressively
    const words = truncatedText.trim().split(' ');
    let safeContent = '';
    for (const word of words) {
      const testResult = `${safeContent} ${word} ${primaryUrl}`;
      const testLength = testResult.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23)).length;
      if (testLength > maxLength) break;
      safeContent += (safeContent ? ' ' : '') + word;
    }
    const emergencyResult = `${safeContent.trim()} ${primaryUrl}`;
    console.log(`🚨 Emergency result: "${emergencyResult}" (${emergencyResult.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23)).length} chars)`);
    return emergencyResult;
  }
  
  console.log(`✅ URL preserved successfully: ${twitterLength} Twitter chars`);
  console.log(`🔗 Result: "${finalResult}"`);
  
  return finalResult;
}

/**
 * Smart truncation for text without URLs
 * ENHANCED: Better sentence boundary detection and cleaner endings
 */
function smartTruncateNoUrls(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  console.log(`📝 Smart truncating: ${text.length} → ${maxLength} chars`);

  // Priority 1: Try to end at sentence boundaries
  const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  for (const ender of sentenceEnders) {
    const lastSentence = text.lastIndexOf(ender);
    if (lastSentence > maxLength * 0.6 && lastSentence < maxLength) {
      const result = text.substring(0, lastSentence + 1).trim();
      console.log(`✂️ Cut at sentence: "${result.slice(-30)}"`);
      return result;
    }
  }

  // Priority 2: Try to end at clause boundaries  
  const clauseEnders = [', ', '; ', ': ', ',\n', ';\n', ':\n'];
  for (const ender of clauseEnders) {
    const lastClause = text.lastIndexOf(ender);
    if (lastClause > maxLength * 0.7 && lastClause < maxLength) {
      const result = text.substring(0, lastClause).trim();
      console.log(`✂️ Cut at clause: "${result.slice(-30)}"`);
      return result;
    }
  }

  // Priority 3: End at word boundaries with smart completion
  const words = text.split(' ');
  let result = '';
  
  for (const word of words) {
    if ((result + ' ' + word).length > maxLength) {
      break;
    }
    result += (result ? ' ' : '') + word;
  }

  // Smart cleanup - avoid awkward endings
  result = cleanupTruncatedEnding(result);

  console.log(`✂️ Cut at word boundary: "${result.slice(-30)}"`);
  return result;
}

/**
 * Cleans up truncated endings to avoid awkward cutoffs
 * ENHANCED: Better detection of incomplete phrases
 */
function cleanupTruncatedEnding(text: string): string {
  // Remove incomplete phrases that would be confusing
  const awkwardEndings = [
    ' with', ' and', ' or', ' but', ' the', ' a', ' an', ' of', ' in', ' on', ' at',
    ' for', ' to', ' from', ' by', ' as', ' is', ' are', ' was', ' were', ' has', ' have',
    ' can', ' will', ' would', ' could', ' should', ' may', ' might', ' this', ' that',
    ' who', ' what', ' when', ' where', ' why', ' how', ' which', ' whose', ' if', ' than',
    ' AI', ' machine', ' learning', ' algorithm', ' data', ' model', ' system'
  ];
  
  let cleaned = text;
  for (const ending of awkwardEndings) {
    if (cleaned.endsWith(ending)) {
      cleaned = cleaned.slice(0, -ending.length).trim();
    }
  }

  // If we ended mid-sentence and it's a reasonable length, add period
  if (cleaned && !cleaned.match(/[.!?]$/) && cleaned.split(' ').length >= 5) {
    // Check if it looks like a complete thought
    const lastSentenceStart = Math.max(
      cleaned.lastIndexOf('. '),
      cleaned.lastIndexOf('! '),
      cleaned.lastIndexOf('? '),
      0
    );
    
    const lastSentence = cleaned.substring(lastSentenceStart).trim();
    if (lastSentence.split(' ').length >= 3) {
      cleaned += '.';
    }
  }

  return cleaned.trim();
}

/**
 * Validates that URLs are properly preserved in tweet content
 * ENHANCED: More thorough validation with better error reporting
 */
export function validateUrlPreservation(originalContent: string, processedContent: string): boolean {
  const originalUrls = originalContent.match(/https?:\/\/[^\s]+/g) || [];
  const processedUrls = processedContent.match(/https?:\/\/[^\s]+/g) || [];
  
  if (originalUrls.length === 0) {
    console.log(`✅ No URLs to validate`);
    return true; // No URLs to preserve
  }

  // Check that at least the first URL is preserved exactly
  const firstOriginalUrl = originalUrls[0];
  const hasPreservedUrl = processedUrls.some(url => url === firstOriginalUrl);
  
  if (!hasPreservedUrl) {
    console.error(`❌ URL preservation failed!`);
    console.error(`Expected URL: "${firstOriginalUrl}"`);
    console.error(`Found URLs: ${JSON.stringify(processedUrls)}`);
    console.error(`Processed content: "${processedContent}"`);
    return false;
  }

  // Additional validation: check for content exceeding Twitter limits
  const actualLength = processedContent.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23)).length;
  
  if (actualLength > 280) {
    console.error(`❌ Content exceeds Twitter limit after URL counting!`);
    console.error(`Actual length: ${actualLength}/280 chars`);
    console.error(`Content: "${processedContent}"`);
    return false;
  }

  console.log(`✅ URL preservation validated: "${firstOriginalUrl}"`);
  console.log(`📊 Content length: ${processedContent.length}/280 chars`);
  return true;
}

/**
 * Ensures URLs appear correctly in tweet format
 */
export function formatUrlsInTweet(content: string): string {
  // Ensure there's proper spacing around URLs
  let formatted = content.replace(/([^\s])https?:\/\//g, '$1 https://');
  formatted = formatted.replace(/https?:\/\/[^\s]+([^\s.])/g, '$& ');
  
  // Clean up any double spaces
  formatted = formatted.replace(/\s+/g, ' ').trim();
  
  return formatted;
} 