import { RealTimeEngagementTracker } from '../agents/realTimeEngagementTracker';

const g = globalThis as any;
export const realTimeEngagementTracker = g.realTimeEngagementTracker ?? (g.realTimeEngagementTracker = new RealTimeEngagementTracker());
