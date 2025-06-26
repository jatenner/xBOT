import { NewsAPIAgent } from '../agents/newsAPIAgent';

const g = globalThis as any;
export const newsAgent = g.newsAgent ?? (g.newsAgent = NewsAPIAgent.getInstance());
