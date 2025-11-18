/**
 * 🔥 VIRAL FORMULAS HELPER
 * 
 * Provides viral formulas that all generators can use
 * 
 * NOW DATA-DRIVEN: Learns from actual successful posts instead of hardcoding
 * Uses your existing learning systems to extract what actually works
 */

import { 
  getViralFormulasForGenerator, 
  getTopViralFormulas,
  formatViralFormulaAsPrompt,
  BASE_VIRAL_FORMULAS 
} from './comprehensiveViralFormulas';
import { dataDrivenViralFormulas } from './dataDrivenViralFormulas';

/**
 * Get viral formulas section for a specific generator
 * NOW DATA-DRIVEN: Learns from actual performance
 */
export async function getViralFormulasSection(generatorName?: string): Promise<string> {
  try {
    // Try to get data-driven formulas first (learned from actual performance)
    const learnedFormulas = generatorName 
      ? await dataDrivenViralFormulas.getViralFormulasForGenerator(generatorName)
      : await dataDrivenViralFormulas.getTopFormulas(10);

    if (learnedFormulas.length > 0) {
      // Use learned formulas (from actual data)
      return formatLearnedFormulas(learnedFormulas, generatorName);
    }
  } catch (error: any) {
    console.warn('[VIRAL_FORMULAS] ⚠️ Data-driven formulas unavailable, using fallback:', error.message);
  }

  // Fallback to base formulas if data-driven unavailable
  if (!generatorName) {
    return formatBaseFormulas();
  }

  const topFormulas = getTopViralFormulas(generatorName, 8);
  const baseFormulas = BASE_VIRAL_FORMULAS.slice(0, 5);

  return `🔥 VIRAL FORMULAS (BASE PATTERNS - use when they fit):

${baseFormulas.map(f => formatViralFormulaAsPrompt(f)).join('\n\n')}

${topFormulas.length > 0 ? `\n${generatorName.toUpperCase()} SPECIFIC:
${topFormulas.map(f => formatViralFormulaAsPrompt(f)).join('\n\n')}` : ''}

Note: System is learning from your actual performance data. Formulas will improve as more data is collected.`;
}

function formatLearnedFormulas(formulas: any[], generatorName?: string): string {
  const top5 = formulas.slice(0, 5);
  
  return `🔥 VIRAL FORMULAS (LEARNED FROM YOUR ACTUAL PERFORMANCE):

These formulas were extracted from your successful posts and viral replies (10K-100K views).

${top5.map((f, i) => `
${i + 1}. ${f.name}
   Structure: "${f.structure}"
   Example: "${f.example}"
   Performance: ${(f.performance.avgEngagementRate * 100).toFixed(1)}% engagement, ${f.performance.followerConversion.toFixed(3)} followers/1K views
   Confidence: ${(f.performance.confidence * 100).toFixed(0)}% (based on ${f.performance.sampleSize} examples)
   Source: ${f.extractedFrom.replace('_', ' ')}
`).join('\n')}

${formulas.length > 5 ? `\n... and ${formulas.length - 5} more formulas learned from your data` : ''}

CURIOSITY TRIGGERS (from successful posts):
✅ "The real reason..."
✅ "Most people don't realize..."
✅ "Latest research shows..."
✅ "The mechanism involves..."
✅ "Researchers discovered..."

Apply these formulas naturally - they're based on what actually works for your account.`;
}

function formatBaseFormulas(): string {
  return `🔥 VIRAL FORMULAS (PROVEN ENGAGEMENT PATTERNS):

${BASE_VIRAL_FORMULAS.slice(0, 10).map(f => formatViralFormulaAsPrompt(f)).join('\n\n')}

CURIOSITY TRIGGERS (use these phrases):
✅ "The real reason..."
✅ "Most people don't realize..."
✅ "Latest research shows..."
✅ "The mechanism involves..."
✅ "Researchers discovered..."

Apply these formulas naturally within your generator's personality.`;
}

/**
 * Get all available viral formulas (for reference)
 */
export function getAllViralFormulas(): string {
  return getViralFormulasSection();
}

