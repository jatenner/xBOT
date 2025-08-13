import { ThreadSchema } from './systemPrompt';

export interface EvaluationScores {
  hook_clarity: number;
  novelty: number;
  evidence: number;
  actionability: number;
  risk_penalty: number;
  overall: number;
  reasons: string[];
}

export const EVALUATOR_PROMPT = `You are evaluating a health thread for Twitter/X. Rate each aspect 0-100 and provide reasons.

Evaluation Criteria:
1. Hook clarity (0-100): Is the promise crisp & specific? Does T1 clearly state the benefit?
2. Novelty (0-100): Non-obvious / myth-bust / counter-intuitive insights?
3. Evidence strength (0-100): Reputable sources (CDC/NIH/WHO/Harvard/Cochrane/NHS) + specific claims?
4. Actionability (0-100): Clear next actions readers can take immediately?
5. Risk penalty (0-100): Higher = safer. Penalize overclaiming/medical advice. Reward cautious language ("may", "can", "linked with").

Medical Safety: Threads should use cautious verbs, avoid diagnosis/treatment advice, prefer lifestyle guidance with reputable sources.

Return JSON exactly:
{
  "hook_clarity": 0-100,
  "novelty": 0-100, 
  "evidence": 0-100,
  "actionability": 0-100,
  "risk_penalty": 0-100,
  "reasons": ["reason1", "reason2", ...]
}`;

export function computeOverallScore(scores: Omit<EvaluationScores, 'overall' | 'reasons'>): number {
  const { hook_clarity, novelty, evidence, actionability, risk_penalty } = scores;
  
  // Overall = 0.28*hook + 0.24*novelty + 0.28*evidence + 0.20*actionability - 0.00*risk_penalty
  // Risk penalty is actually a safety bonus (higher = safer), so we add it with small weight
  return Math.round(
    0.28 * hook_clarity + 
    0.24 * novelty + 
    0.28 * evidence + 
    0.20 * actionability +
    0.05 * (risk_penalty - 50) // Bonus/penalty relative to neutral 50
  );
}

export function validateEvaluationScores(data: any): EvaluationScores {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid evaluation data: must be object');
  }
  
  const required = ['hook_clarity', 'novelty', 'evidence', 'actionability', 'risk_penalty', 'reasons'];
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Missing required evaluation field: ${field}`);
    }
  }
  
  // Validate score ranges
  const scoreFields = ['hook_clarity', 'novelty', 'evidence', 'actionability', 'risk_penalty'];
  for (const field of scoreFields) {
    const score = data[field];
    if (typeof score !== 'number' || score < 0 || score > 100) {
      throw new Error(`${field} must be a number between 0-100`);
    }
  }
  
  if (!Array.isArray(data.reasons)) {
    throw new Error('reasons must be an array');
  }
  
  const overall = computeOverallScore(data);
  
  return {
    ...data,
    overall
  } as EvaluationScores;
}