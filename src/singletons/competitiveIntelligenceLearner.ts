import { CompetitiveIntelligenceLearner } from '../agents/competitiveIntelligenceLearner';

const g = globalThis as any;
export const competitiveIntelligenceLearner = g.competitiveIntelligenceLearner ?? (g.competitiveIntelligenceLearner = CompetitiveIntelligenceLearner.getInstance());
