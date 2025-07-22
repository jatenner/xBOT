export interface FormattedTweet {
  content: string;
  hasImage?: boolean;
}

export function formatTweet(content: string): FormattedTweet {
  try {
    // Simple formatting: ensure no hashtags and proper length
    let formatted = content.trim();
    
    // Remove hashtags
    formatted = formatted.replace(/#\w+/g, '').trim();
    
    // Ensure proper length (Twitter limit is 280)
    if (formatted.length > 250) {
      formatted = formatted.substring(0, 247) + '...';
    }
    
    return {
      content: formatted,
      hasImage: false
    };
  } catch (error) {
    console.warn('Format tweet error:', error);
    return {
      content: content,
      hasImage: false
    };
  }
} 