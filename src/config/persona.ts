export interface PersonaConfig {
  name: string;
  promise: string; // what followers get daily
  tone: 'friendly' | 'evidence_led' | 'coach' | 'analyst';
  pillars: Array<{ key: string; ratio: number; description: string }>;
  cadence: { postsPerDay: number; threadsPerDay: number; repliesPerDay: [number, number] };
}

export const HEALTH_PERSONA: PersonaConfig = {
  name: 'Snap2Health',
  promise: 'Daily, evidence‑led health insights you can use in 60 seconds.',
  tone: 'evidence_led',
  pillars: [
    { key: 'myth_buster', ratio: 0.25, description: 'Debunk common health myths with citations.' },
    { key: 'practical_tip', ratio: 0.35, description: 'Actionable 1–2 step tips with context.' },
    { key: 'mini_thread', ratio: 0.20, description: 'Short 4–6 step threads with one clear takeaway.' },
    { key: 'expert_react', ratio: 0.10, description: 'Thoughtful reactions to top experts.' },
    { key: 'community_prompt', ratio: 0.10, description: 'Audience‑centric prompts based on prior wins.' },
  ],
  cadence: { postsPerDay: 3, threadsPerDay: 1, repliesPerDay: [6, 12] },
};

