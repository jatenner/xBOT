// 🚨 NUCLEAR CONTENT VALIDATION
// Prevent ALL fake content from being posted

export function isNuclearBlockedContent(content: string): boolean {
    // Nuclear-level blocking - if ANY of these patterns match, BLOCK IMMEDIATELY
    const nuclearPatterns = [
        // Block ALL reply-like content
        /reply to tweet/i,
        /Reply to tweet/i,
        /REPLY TO TWEET/i,
        
        // Block ALL mock content
        /mock_tweet/i,
        /mock tweet/i,
        /Mock Tweet/i,
        
        // Block incomplete hooks
        /here's how to .+(?:in \d+ minutes?)?:?\s*$/i,
        /here are \d+ ways to .+:?\s*$/i,
        /the secret to .+ is:?\s*$/i,
        /\d+ tips for .+:?\s*$/i,
        
        // Block action-like content
        /action for user/i,
        /would have performed/i,
        
        // Block any content that sounds like system messages
        /system disabled/i,
        /functionality disabled/i,
        /emergency disabled/i
    ];

    for (const pattern of nuclearPatterns) {
        if (pattern.test(content.trim())) {
            console.log(`🚨 NUCLEAR BLOCK: ${pattern.source}`);
            console.log(`🚫 BLOCKED CONTENT: "${content.substring(0, 100)}..."`);
            return true;
        }
    }

    return false;
}

export const NUCLEAR_CONTENT_VALIDATION = {
    isBlocked: isNuclearBlockedContent,
    reason: 'NUCLEAR validation - prevents ALL fake/reply/mock content'
};