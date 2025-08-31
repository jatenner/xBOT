/**
 * 🔥 CONTROVERSIAL HEALTH TOPICS
 * 
 * High-engagement topics that challenge conventional wisdom
 */

export interface ControversialTopic {
  topic: string;
  angle: string;
  controversy_level: number; // 1-10
  viral_potential: number; // 0-1
  hook_template: string;
}

export const CONTROVERSIAL_HEALTH_TOPICS: ControversialTopic[] = [
  {
    topic: "intermittent fasting",
    angle: "why eating 6 meals a day ruins your metabolism",
    controversy_level: 7,
    viral_potential: 0.8,
    hook_template: "The fitness industry lied about meal frequency. Here's what really optimizes your metabolism:"
  },
  {
    topic: "sunscreen",
    angle: "how avoiding sun damages your health more than sun exposure",
    controversy_level: 8,
    viral_potential: 0.9,
    hook_template: "Your doctor won't tell you this about sunscreen and vitamin D:"
  },
  {
    topic: "cholesterol",
    angle: "why low cholesterol is more dangerous than high cholesterol",
    controversy_level: 9,
    viral_potential: 0.85,
    hook_template: "The cholesterol myth that's killing people. Here's what cardiologists don't want you to know:"
  },
  {
    topic: "sleep position",
    angle: "why sleeping on your side ages your face faster",
    controversy_level: 6,
    viral_potential: 0.75,
    hook_template: "I slept on my side for 30 years. The damage was shocking:"
  },
  {
    topic: "breakfast",
    angle: "why breakfast is the least important meal of the day",
    controversy_level: 7,
    viral_potential: 0.8,
    hook_template: "The breakfast industry created the biggest nutrition lie in history:"
  },
  {
    topic: "water intake",
    angle: "why drinking 8 glasses of water is harmful",
    controversy_level: 8,
    viral_potential: 0.85,
    hook_template: "Most people get hydration wrong. This simple mistake is damaging your kidneys:"
  },
  {
    topic: "multivitamins",
    angle: "how multivitamins make you less healthy",
    controversy_level: 7,
    viral_potential: 0.8,
    hook_template: "The supplement industry doesn't want you to know this about multivitamins:"
  },
  {
    topic: "cardio exercise",
    angle: "why cardio accelerates aging",
    controversy_level: 8,
    viral_potential: 0.85,
    hook_template: "I did cardio for 10 years. Here's the damage it caused to my body:"
  },
  {
    topic: "organic food",
    angle: "why organic food is a marketing scam",
    controversy_level: 8,
    viral_potential: 0.8,
    hook_template: "The organic food industry's dirty secret that's wasting your money:"
  },
  {
    topic: "meditation",
    angle: "how meditation can worsen anxiety",
    controversy_level: 6,
    viral_potential: 0.75,
    hook_template: "Meditation made my anxiety worse. Here's what actually works:"
  },
  {
    topic: "plant-based diet",
    angle: "why vegan diets destroy your brain health",
    controversy_level: 9,
    viral_potential: 0.9,
    hook_template: "I was vegan for 5 years. The cognitive damage was terrifying:"
  },
  {
    topic: "stretching",
    angle: "why stretching before exercise increases injury risk",
    controversy_level: 7,
    viral_potential: 0.8,
    hook_template: "Physical therapists know this secret about stretching that most people don't:"
  }
];

export function getRandomControversialTopic(): ControversialTopic {
  const highViralTopics = CONTROVERSIAL_HEALTH_TOPICS.filter(t => t.viral_potential >= 0.8);
  return highViralTopics[Math.floor(Math.random() * highViralTopics.length)];
}

export function getTopicByControversyLevel(minLevel: number = 7): ControversialTopic[] {
  return CONTROVERSIAL_HEALTH_TOPICS.filter(t => t.controversy_level >= minLevel);
}

export function getTopicByViralPotential(minPotential: number = 0.8): ControversialTopic[] {
  return CONTROVERSIAL_HEALTH_TOPICS.filter(t => t.viral_potential >= minPotential);
}
