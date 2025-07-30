
// 🎯 ENHANCED CONTENT QUALITY VALIDATION
export class EnhancedContentValidator {
    
    static async validatePostingContent(content: string): Promise<{
        isValid: boolean;
        qualityScore: number;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];
        let qualityScore = 100;
        
        // 1. Check for incomplete hooks
        if (this.hasIncompleteHook(content)) {
            issues.push('Incomplete hook detected');
            qualityScore -= 50;
            recommendations.push('Provide complete actionable information');
        }
        
        // 2. Check for actionable value
        if (!this.hasActionableValue(content)) {
            issues.push('Lacks specific actionable value');
            qualityScore -= 30;
            recommendations.push('Include specific tips, numbers, or steps');
        }
        
        // 3. Check engagement potential
        const engagementScore = this.calculateEngagementPotential(content);
        if (engagementScore < 50) {
            issues.push('Low engagement potential');
            qualityScore -= 20;
            recommendations.push('Add compelling hook or question');
        }
        
        // 4. Check for authority markers
        if (!this.hasAuthorityMarkers(content)) {
            qualityScore -= 10;
            recommendations.push('Consider adding data, studies, or specific numbers');
        }
        
        return {
            isValid: issues.length === 0 && quality score >= 55,
            qualityScore,
            issues,
            recommendations
        };
    }
    
    private static hasIncompleteHook(content: string): boolean {
        const incompletePatterns = [
            /here's how to \w+[.:]?$/mi,
            /the secret to \w+[.:]?$/mi,
            /\d+ ways? to \w+[.:]?$/mi,
            /i discovered \w+[.:]?$/mi
        ];
        
        return incompletePatterns.some(pattern => pattern.test(content));
    }
    
    private static hasActionableValue(content: string): boolean {
        const valueMarkers = [
            /\d+[gm%]\b/, // Numbers with units
            /\b(try|use|set|take|avoid|increase|decrease)\b/i,
            /\b(study|research|data|found)\b/i,
            /:/, // Lists or explanations
            /\b(tip|step|method|way)\b/i
        ];
        
        return valueMarkers.some(marker => marker.test(content));
    }
    
    private static calculateEngagementPotential(content: string): number {
        let score = 50;
        
        // Question or CTA at end
        if (/[?]\s*$/.test(content)) score += 20;
        
        // Numbers and data
        if (/\d+%/.test(content)) score += 15;
        
        // Strong verbs
        if (/\b(discovered|proven|revealed|shocking)\b/i.test(content)) score += 10;
        
        // Controversy or contrarian viewpoint
        if (/\b(myth|wrong|lie|actually|truth)\b/i.test(content)) score += 15;
        
        return Math.min(score, 100);
    }
    
    private static hasAuthorityMarkers(content: string): boolean {
        const authorityPatterns = [
            /\b(study|research|scientists?|doctors?)\b/i,
            /\d+%/,
            /\b(published|journal|university)\b/i,
            /\b(data|evidence|study)\b/i
        ];
        
        return authorityPatterns.some(pattern => pattern.test(content));
    }
}