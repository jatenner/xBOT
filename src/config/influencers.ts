/**
 * 🎯 INFLUENCER TARGET CONFIGURATION
 * 
 * Defines high-value health/wellness influencers to monitor for reply opportunities
 */

export interface InfluencerTarget {
  username: string;
  displayName: string;
  niche: string;
  priority: 'high' | 'medium' | 'low';
  replyStyle: 'supportive' | 'questioning' | 'contrarian' | 'educational';
  avgEngagement: number; // typical like count for filtering
  topicCategories: string[];
  notes?: string;
}

export const INFLUENCER_TARGETS: InfluencerTarget[] = [
  // High-Priority Health/Medical Influencers
  {
    username: 'peterattia',
    displayName: 'Peter Attia',
    niche: 'longevity_medicine',
    priority: 'high',
    replyStyle: 'educational',
    avgEngagement: 2000,
    topicCategories: ['longevity', 'nutrition', 'exercise', 'medicine'],
    notes: 'MD focused on longevity science'
  },
  {
    username: 'hubermanlab',
    displayName: 'Andrew Huberman',
    niche: 'neuroscience',
    priority: 'high',
    replyStyle: 'supportive',
    avgEngagement: 5000,
    topicCategories: ['neuroscience', 'sleep', 'exercise', 'supplements'],
    notes: 'Stanford neuroscientist, very engaged audience'
  },
  {
    username: 'rhondapatrick',
    displayName: 'Rhonda Patrick',
    niche: 'nutrition_science',
    priority: 'high',
    replyStyle: 'educational',
    avgEngagement: 1500,
    topicCategories: ['nutrition', 'supplements', 'aging', 'research'],
    notes: 'PhD nutrition researcher, FoundMyFitness'
  },
  {
    username: 'davidsinclairharvard',
    displayName: 'David Sinclair',
    niche: 'aging_research',
    priority: 'high',
    replyStyle: 'questioning',
    avgEngagement: 3000,
    topicCategories: ['aging', 'longevity', 'research', 'supplements'],
    notes: 'Harvard aging researcher'
  },
  {
    username: 'drmarkhyman',
    displayName: 'Mark Hyman',
    niche: 'functional_medicine',
    priority: 'medium',
    replyStyle: 'supportive',
    avgEngagement: 1000,
    topicCategories: ['functional_medicine', 'nutrition', 'gut_health'],
    notes: 'Functional medicine physician'
  },
  {
    username: 'drpaulclayton',
    displayName: 'Paul Clayton',
    niche: 'clinical_nutrition',
    priority: 'medium',
    replyStyle: 'educational',
    avgEngagement: 800,
    topicCategories: ['nutrition', 'clinical_research', 'supplements'],
    notes: 'Clinical nutritionist, pharmaco-nutrition expert'
  },
  {
    username: 'drdavinagner',
    displayName: 'Davina Giner',
    niche: 'womens_health',
    priority: 'medium',
    replyStyle: 'supportive',
    avgEngagement: 600,
    topicCategories: ['womens_health', 'hormones', 'nutrition'],
    notes: 'Women\'s health specialist'
  },
  {
    username: 'drjockers',
    displayName: 'Dr. David Jockers',
    niche: 'natural_health',
    priority: 'low',
    replyStyle: 'educational',
    avgEngagement: 400,
    topicCategories: ['natural_health', 'nutrition', 'detox'],
    notes: 'Natural health practitioner'
  },
  {
    username: 'bengreenfield',
    displayName: 'Ben Greenfield',
    niche: 'biohacking',
    priority: 'medium',
    replyStyle: 'questioning',
    avgEngagement: 1200,
    topicCategories: ['biohacking', 'fitness', 'supplements', 'performance'],
    notes: 'Biohacker and fitness expert'
  },
  {
    username: 'drwillcole',
    displayName: 'Dr. Will Cole',
    niche: 'functional_medicine',
    priority: 'medium',
    replyStyle: 'supportive',
    avgEngagement: 800,
    topicCategories: ['functional_medicine', 'autoimmune', 'nutrition'],
    notes: 'Functional medicine practitioner'
  }
];

export const REPLY_TIMING_CONFIG = {
  // Time windows when replies are most effective (UTC hours)
  optimalHours: [13, 14, 15, 16, 17, 18, 19, 20, 21], // 9AM-5PM ET
  maxRepliesPerHour: 2,
  maxRepliesPerInfluencer: 1, // per day
  cooldownHours: 24,
  
  // Content filtering
  minLikeCount: 100,
  maxReplyCount: 50, // avoid oversaturated threads
  maxContentAge: 4, // hours
  
  // Quality thresholds
  minContentLength: 50, // characters
  avoidKeywords: ['RT', 'retweet', 'giveaway', 'contest', 'sponsored'],
  preferKeywords: ['study', 'research', 'new', 'finding', 'breakthrough']
};

export const TOPIC_REPLY_STRATEGIES = {
  longevity: {
    supportive: "Fascinating research! I've seen similar findings in {citation}. What's your take on {question}?",
    questioning: "Interesting point. How does this reconcile with {citation} showing different results?",
    educational: "Building on this: {citation} suggests {insight}. Worth exploring both angles.",
    contrarian: "Actually, {citation} shows the opposite effect. Could there be methodological differences?"
  },
  nutrition: {
    supportive: "Great point! {citation} supports this, especially regarding {detail}.",
    questioning: "Curious about the dosage/timing here. {citation} suggests {alternative}?",
    educational: "Adding context: {citation} found {insight} in similar populations.",
    contrarian: "Respectfully disagree. {citation} demonstrates {counterpoint}."
  },
  exercise: {
    supportive: "Exactly! {citation} confirms this, particularly for {population}.",
    questioning: "What about individual variation? {citation} shows {alternative} in some cases.",
    educational: "Related finding: {citation} reveals {insight} about this mechanism.",
    contrarian: "Interesting, but {citation} suggests {counterpoint} might be more accurate."
  },
  supplements: {
    supportive: "Well said! {citation} backs this up with solid data.",
    questioning: "What about bioavailability? {citation} shows {concern} with this approach.",
    educational: "Key detail: {citation} indicates {insight} about optimal dosing.",
    contrarian: "Caution warranted. {citation} found {safety_concern} in some studies."
  }
};

export function getInfluencerByUsername(username: string): InfluencerTarget | undefined {
  return INFLUENCER_TARGETS.find(inf => inf.username.toLowerCase() === username.toLowerCase());
}

export function getHighPriorityInfluencers(): InfluencerTarget[] {
  return INFLUENCER_TARGETS.filter(inf => inf.priority === 'high');
}

export function getInfluencersByTopic(topic: string): InfluencerTarget[] {
  return INFLUENCER_TARGETS.filter(inf => 
    inf.topicCategories.some(cat => 
      cat.toLowerCase().includes(topic.toLowerCase()) || 
      topic.toLowerCase().includes(cat.toLowerCase())
    )
  );
}