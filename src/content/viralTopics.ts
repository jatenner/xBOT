/**
 * VIRAL TOPIC GENERATOR - Diverse follower-magnet content
 */

export interface ViralTopic {
  topic: string;
  angle: string;
  hook_type: 'contradiction' | 'secret' | 'conspiracy' | 'results';
  follower_appeal: string;
}

export const VIRAL_TOPICS: ViralTopic[] = [
  // CONTROVERSIAL TAKES
  {
    topic: 'breakfast myths',
    angle: 'breakfast is actually destroying your metabolism',
    hook_type: 'contradiction',
    follower_appeal: 'challenges deeply held belief about most important meal'
  },
  {
    topic: 'multivitamin industry lies',
    angle: 'synthetic vitamins are making you sicker',
    hook_type: 'conspiracy',
    follower_appeal: 'exposes billion-dollar industry deception'
  },
  {
    topic: 'cardio for fat loss',
    angle: 'cardio actually prevents fat loss through metabolic damage',
    hook_type: 'contradiction',
    follower_appeal: 'shocking revelation about gym culture'
  },
  
  // EXPENSIVE BIOHACK SECRETS
  {
    topic: 'red light therapy protocols',
    angle: '$5K red light secrets I learned from elite athletes',
    hook_type: 'secret',
    follower_appeal: 'exclusive expensive knowledge shared for free'
  },
  {
    topic: 'NAD+ optimization',
    angle: 'longevity clinic charges $2K for this protocol',
    hook_type: 'secret',
    follower_appeal: 'insider medical knowledge'
  },
  {
    topic: 'mitochondrial enhancement',
    angle: 'billionaire biohackers use this $10K protocol',
    hook_type: 'secret',
    follower_appeal: 'elite health optimization secrets'
  },
  
  // IMMEDIATE RESULTS
  {
    topic: 'dopamine reset protocol',
    angle: 'fix your dopamine in 48 hours with this simple trick',
    hook_type: 'results',
    follower_appeal: 'quick mental health improvement'
  },
  {
    topic: 'inflammation reduction',
    angle: 'eliminate chronic inflammation in 72 hours',
    hook_type: 'results',
    follower_appeal: 'fast pain relief and energy boost'
  },
  {
    topic: 'sleep optimization hack',
    angle: 'fall asleep in 5 minutes every night with this method',
    hook_type: 'results',
    follower_appeal: 'immediate sleep improvement'
  },
  
  // DOCTOR CONSPIRACIES
  {
    topic: 'thyroid testing deception',
    angle: 'why doctors hide the real thyroid tests from you',
    hook_type: 'conspiracy',
    follower_appeal: 'medical establishment cover-up revelation'
  },
  {
    topic: 'cholesterol medication scam',
    angle: 'Big Pharma buried this cholesterol study for 20 years',
    hook_type: 'conspiracy',
    follower_appeal: 'pharmaceutical industry corruption'
  },
  {
    topic: 'hormone replacement lies',
    angle: 'doctors prescribe dangerous hormones while hiding safe alternatives',
    hook_type: 'conspiracy',
    follower_appeal: 'medical malpractice exposure'
  },
  
  // TRENDING HEALTH TOPICS
  {
    topic: 'ozempic alternatives',
    angle: 'natural GLP-1 activation that works better than Ozempic',
    hook_type: 'secret',
    follower_appeal: 'trendy weight loss drug alternative'
  },
  {
    topic: 'microplastic detox',
    angle: 'remove microplastics from your body in 30 days',
    hook_type: 'results',
    follower_appeal: 'timely environmental health concern'
  },
  {
    topic: 'seed oil toxicity',
    angle: 'seed oils are more toxic than smoking',
    hook_type: 'contradiction',
    follower_appeal: 'shocking comparison to smoking'
  }
];

export function getRandomViralTopic(): ViralTopic {
  return VIRAL_TOPICS[Math.floor(Math.random() * VIRAL_TOPICS.length)];
}

export function getTopicByType(hook_type: ViralTopic['hook_type']): ViralTopic {
  const filtered = VIRAL_TOPICS.filter(t => t.hook_type === hook_type);
  return filtered[Math.floor(Math.random() * filtered.length)];
}
