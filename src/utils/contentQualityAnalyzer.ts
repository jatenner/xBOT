// 🎯 CONTENT QUALITY ANALYZER
// Analyze content for viral potential and audience growth

export interface ContentAnalysis {
    viral_score: number; // 0-100
    audience_growth_potential: number; // 0-100
    engagement_prediction: number; // estimated likes/retweets
    quality_issues: string[];
    improvements: string[];
    algorithmic_factors: {
        hook_strength: number;
        value_density: number;
        shareability: number;
        authority_signals: number;
        engagement_triggers: number;
    };
}

export function analyzeContentQuality(content: string): ContentAnalysis {
    const issues: string[] = [];
    const improvements: string[] = [];
    
    // Check for incomplete hooks
    if (/here['']?s how to .+:?\s*$/i.test(content)) {
        issues.push("CRITICAL: Incomplete hook - no follow-through content");
        improvements.push("Provide the actual 'how to' steps immediately");
    }
    
    // Check for value density
    if (content.length < 100) {
        issues.push("Too short - lacks substance for audience building");
        improvements.push("Add more specific, actionable details");
    }
    
    // Check for authority signals (suggestion, not requirement)
    if (!/\d+/.test(content) && !/study|research|data/i.test(content)) {
        improvements.push("Consider adding statistics, study results, or specific numbers for more authority");
    }
    
    // Check for engagement triggers (suggestion, not requirement)
    if (!/\?\s*$/.test(content)) {
        improvements.push("Consider ending with a question to drive replies");
    }
    
    // Check for shareability (suggestion, not requirement)
    if (!/surprising|shocking|wrong|myth|truth|secret|backwards|lie|scam|fake|exposed|revealed|hidden|breakthrough|discover/i.test(content)) {
        improvements.push("Consider including surprising or contrarian insights for more shares");
    }
    
    // Calculate scores
    const viral_score = Math.max(0, 100 - (issues.length * 20));
    const audience_growth_potential = viral_score; // Same for now
    const engagement_prediction = viral_score * 10; // Rough estimate
    
    return {
        viral_score,
        audience_growth_potential,
        engagement_prediction,
        quality_issues: issues,
        improvements,
        algorithmic_factors: {
            hook_strength: content.match(/^[^.!?]{1,50}[.!?]/) ? 80 : 40,
            value_density: Math.min(100, content.length / 2),
            shareability: issues.length === 0 ? 90 : 50,
            authority_signals: /\d+|study|research/i.test(content) ? 90 : 30,
            engagement_triggers: /\?\s*$/.test(content) ? 90 : 20
        }
    };
}

export function shouldPostContent(analysis: ContentAnalysis): boolean {
    // More permissive during learning phase - focus on critical issues only
    const hasCriticalIssues = analysis.quality_issues.some(issue => 
        issue.includes('CRITICAL') || issue.includes('Incomplete hook')
    );
    
    // Allow posts with viral score 40+ and no critical issues
    return analysis.viral_score >= 40 && !hasCriticalIssues;
}