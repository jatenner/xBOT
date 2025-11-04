/**
 * 🔥 FALLBACK VIRAL INSIGHTS
 * Used when no database patterns exist yet
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export async function generateFallbackViralInsights(
  generator: string,
  tone: string
): Promise<string> {
  
  console.log('[VIRAL_FALLBACK] 🤖 Generating AI insights for viral formatting...');
  
  const prompt = `You're a Twitter growth expert analyzing what formatting works best for a ${generator} persona using a ${tone} tone.

Based on analyzing thousands of viral health tweets, what formatting principles should be used?

Consider:
- Hook structures that stop scrollers
- Visual layouts that increase engagement
- Emphasis techniques that draw attention
- Length and pacing for readability
- Emoji usage for this persona/tone

Return 3-5 specific, actionable formatting principles as JSON:
{
  "principles": [
    {
      "principle": "Short description",
      "reasoning": "Why it works",
      "example": "Concrete example"
    }
  ]
}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    }, { purpose: 'viral_insights_generation' });
    
    const parsed = JSON.parse(response.choices[0].message.content || '{"principles":[]}');
    const principles = parsed.principles || [];
    
    console.log(`[VIRAL_FALLBACK] ✅ Generated ${principles.length} formatting principles`);
    
    // Format for prompt injection
    const insightsText = principles.map((p: any, i: number) => 
      `${i + 1}. ${p.principle}: ${p.reasoning}\n   Example: ${p.example}`
    ).join('\n\n');
    
    return `\n\nVIRAL FORMATTING INSIGHTS (AI-Generated for ${generator} + ${tone}):\n${insightsText}`;
    
  } catch (error: any) {
    console.error('[VIRAL_FALLBACK] ❌ Failed to generate insights:', error.message);
    // Return empty string - formatter will use its base knowledge
    return '';
  }
}

