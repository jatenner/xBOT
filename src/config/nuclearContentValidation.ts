// 🚨 ENHANCED NUCLEAR CONTENT VALIDATION
// Prevent ALL incomplete/low-quality content that hurts audience growth

export function isNuclearBlockedContent(content: string): boolean {
    // Nuclear-level blocking - ANYTHING that hurts audience growth gets blocked
    const nuclearPatterns = [
        // Block ALL variations of incomplete hooks (apostrophe or not)
        /here['']?s how to .+(?:in \d+ minutes?)?:?\s*$/i,
        /here is how to .+(?:in \d+ minutes?)?:?\s*$/i,
        /heres how to .+(?:in \d+ minutes?)?:?\s*$/i,
        /here are \d+ ways to .+:?\s*$/i,
        /\d+ ways to .+:?\s*$/i,
        /the secret to .+ is:?\s*$/i,
        /\d+ tips for .+:?\s*$/i,
        /want to know how to .+\??\s*$/i,
        /i['']?ll show you how to .+:?\s*$/i,
        /learn how to .+ in .+:?\s*$/i,
        /discover .+ in .+ minutes:?\s*$/i,
        
        // Block ALL reply-like content
        /reply to tweet/i,
        /Reply to tweet/i,
        /REPLY TO TWEET/i,
        
        // Block ALL mock content
        /mock_tweet/i,
        /mock tweet/i,
        /Mock Tweet/i,
        
        // Block action-like content
        /action for user/i,
        /would have performed/i,
        
        // Block system messages
        /system disabled/i,
        /functionality disabled/i,
        /emergency disabled/i,
        
        // Block generic/low-value content
        /check this out/i,
        /click here/i,
        /follow for more/i,
        /what do you think\??\s*$/i,
        /thoughts\??\s*$/i,
        
        // Block content that's too short to be valuable
        /^.{1,30}$/
    ];

    const content_trimmed = content.trim();
    
    for (const pattern of nuclearPatterns) {
        if (pattern.test(content_trimmed)) {
            console.log(`🚨 NUCLEAR BLOCK: ${pattern.source}`);
            console.log(`🚫 BLOCKED CONTENT: "${content.substring(0, 100)}..."`);
            return true;
        }
    }

    return false;
}

export const NUCLEAR_CONTENT_VALIDATION = {
    isBlocked: isNuclearBlockedContent,
    reason: 'NUCLEAR validation - prevents ALL low-quality content that hurts audience growth'
};