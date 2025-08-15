/**
 * Quality Gate for evaluating thread content before posting
 * Ensures content meets minimum standards for engagement and value
 */

export type QualityReport = {
  score: number;
  reasons: string[];
  dims: Record<string, number>;
  passed: boolean;
};

export function scoreThread(hook: string, tweets: { text: string }[]): QualityReport {
  const reasons: string[] = [];
  const dims = { 
    completeness: 0, 
    value: 0, 
    clarity: 0, 
    actionability: 0, 
    evidence: 0, 
    engagement: 0 
  };

  // Basic validators
  const allTexts = [hook, ...tweets.map(t => t.text)];
  
  if (allTexts.some(t => /#{1,6}|\*{1,2}|```|__/.test(t))) {
    reasons.push('markdown formatting present');
  }
  
  if (tweets.length < 5) {
    reasons.push('too few tweets');
  }
  
  if (allTexts.some(t => t.includes('...'))) {
    reasons.push('contains ellipses (incomplete)');
  }

  // Content quality heuristics
  const hasNumbers = tweets.filter(t => /\d/.test(t.text)).length >= Math.ceil(tweets.length / 2);
  const hasImperatives = tweets.filter(t => 
    /\b(try|do|set|use|add|stop|avoid|switch|create|get|track|start|follow|check|measure)\b/i.test(t.text)
  ).length >= Math.ceil(tweets.length / 2);
  
  const hasEvidence = tweets.filter(t => 
    /\b(study|research|found|shows|data|evidence|scientists?|university)\b/i.test(t.text)
  ).length >= 1;
  
  const hasSpecifics = tweets.filter(t => 
    /\b(\d+%|\d+ times?|\d+ hours?|\d+ minutes?|\d+ years?|\d+ people|\d+ days?)\b/i.test(t.text)
  ).length >= Math.ceil(tweets.length / 3);

  const hasPersonal = allTexts.filter(t => 
    /\b(I've|my|personally|in my experience|after \d+ years?)\b/i.test(t)
  ).length >= 1;

  const hasEngagement = allTexts.filter(t => 
    /\?$|what's your|do you|have you|which one|tell me/i.test(t)
  ).length >= 1;

  // Dimension scoring (0–10 each)
  dims.completeness = tweets.length >= 5 && !allTexts.some(t => t.includes('...')) ? 9 : 4;
  dims.value = (hasNumbers ? 3 : 0) + (hasSpecifics ? 3 : 0) + (hasEvidence ? 3 : 0) + 1;
  dims.clarity = allTexts.every(t => t.length <= 260 && t.length >= 60) ? 8 : 5;
  dims.actionability = hasImperatives ? 9 : 6;
  dims.evidence = hasEvidence ? 8 : 4;
  dims.engagement = (hasPersonal ? 3 : 0) + (hasEngagement ? 4 : 0) + 3;

  // Ensure dimensions are capped at 10
  Object.keys(dims).forEach(key => {
    dims[key] = Math.min(10, dims[key]);
  });

  const score = Math.round(
    (dims.completeness * 0.40 +
     dims.value * 0.25 +
     dims.clarity * 0.15 +
     dims.actionability * 0.10 +
     dims.evidence * 0.05 +
     dims.engagement * 0.05) * 10
  );

  const minScore = Number(process.env.QUALITY_MIN_SCORE ?? 85);
  const passed = score >= minScore && reasons.length === 0;

  if (score < minScore) {
    reasons.push(`score ${score} below threshold ${minScore}`);
  }

  // Add specific improvement suggestions
  if (!hasNumbers) reasons.push('lacks specific numbers/data');
  if (!hasImperatives) reasons.push('not actionable enough');
  if (!hasEvidence) reasons.push('lacks evidence/credibility');
  if (!hasEngagement) reasons.push('low engagement potential');

  return { score, reasons, dims, passed };
}

export function getQualityThreshold(): number {
  return Number(process.env.QUALITY_MIN_SCORE ?? 85);
}

export function formatQualityReport(report: QualityReport): string {
  const status = report.passed ? '✅ PASSED' : '❌ FAILED';
  const dims = Object.entries(report.dims)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  
  return `${status} Quality Score: ${report.score}/100 (${dims})${
    report.reasons.length > 0 ? ` | Issues: ${report.reasons.join(', ')}` : ''
  }`;
}
