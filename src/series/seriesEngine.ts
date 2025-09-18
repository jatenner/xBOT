/**
 * 📅 SERIES ENGINE
 * Templates for recurring content series with visual-friendly output
 */

import { getConfig } from '../config/config';

export interface SeriesTemplate {
  id: string;
  name: string;
  schedule: string; // cron-like or day pattern
  description: string;
}

export interface SeriesContent {
  templateId: string;
  title: string;
  textBlock: string;
  caption: string;
  hashtags?: string[];
  visualCard?: string; // SVG or URL
  scheduledFor?: Date;
}

export const SERIES_TEMPLATES: SeriesTemplate[] = [
  {
    id: 'myth-monday',
    name: 'Myth Monday',
    schedule: 'MON',
    description: 'Weekly myth-busting content to correct health misinformation'
  },
  {
    id: 'snack-science',
    name: 'Snack-Sized Science',
    schedule: 'WED,FRI',
    description: 'Digestible scientific insights for busy readers'
  },
  {
    id: 'mini-challenge',
    name: '30-Day Mini-Challenge',
    schedule: 'DAILY',
    description: 'Small daily actions for health improvement'
  }
];

export class SeriesEngine {
  /**
   * Generate content for a specific series template
   */
  public async generateSeriesContent(templateId: string, context?: any): Promise<SeriesContent> {
    const template = SERIES_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Unknown series template: ${templateId}`);
    }

    switch (templateId) {
      case 'myth-monday':
        return this.generateMythMondayContent();
      case 'snack-science':
        return this.generateSnackScienceContent();
      case 'mini-challenge':
        return this.generateMiniChallengeContent();
      default:
        throw new Error(`No generator for template: ${templateId}`);
    }
  }

  /**
   * Generate Myth Monday content
   */
  private async generateMythMondayContent(): Promise<SeriesContent> {
    const myths = [
      {
        myth: "You need 8 glasses of water daily",
        truth: "Hydration needs vary by person, activity, and climate. Listen to your body's thirst signals.",
        detail: "The '8 glasses' rule lacks scientific backing. Your kidneys can process 0.8-1L per hour. Overhydration can dilute electrolytes."
      },
      {
        myth: "Carbs are always bad for weight loss",
        truth: "Complex carbohydrates provide sustained energy and support brain function. Quality matters more than quantity.",
        detail: "Whole grains, vegetables, and fruits contain fiber that slows digestion and prevents blood sugar spikes."
      },
      {
        myth: "Supplements can replace a balanced diet",
        truth: "Whole foods provide nutrients in bioavailable forms that supplements can't replicate.",
        detail: "Food contains thousands of compounds that work synergistically. Isolated nutrients in pills often lack cofactors for absorption."
      }
    ];

    const selectedMyth = myths[Math.floor(Math.random() * myths.length)];
    
    const textBlock = `🚫 MYTH: ${selectedMyth.myth}

✅ TRUTH: ${selectedMyth.truth}

🔬 THE SCIENCE: ${selectedMyth.detail}`;

    const caption = `Breaking down health myths with evidence-based insights. What health "fact" surprised you most when you learned it wasn't true?`;

    const visualCard = await this.generateMythMondayCard(selectedMyth);

    return {
      templateId: 'myth-monday',
      title: `Myth Monday: ${selectedMyth.myth.split(' ').slice(0, 4).join(' ')}...`,
      textBlock,
      caption,
      visualCard,
      scheduledFor: this.getNextScheduleDate('MON')
    };
  }

  /**
   * Generate Snack-Sized Science content
   */
  private async generateSnackScienceContent(): Promise<SeriesContent> {
    const scienceBites = [
      {
        topic: "Sleep Architecture",
        fact: "Your brain clears metabolic waste during deep sleep through the glymphatic system",
        implication: "Poor sleep quality = toxin buildup = cognitive decline",
        actionable: "Prioritize 7-9 hours with cool, dark environment for optimal brain detox"
      },
      {
        topic: "Microbiome Diversity",
        fact: "70% of your immune system lives in your gut microbiome",
        implication: "Gut health directly impacts immune response and mood regulation",
        actionable: "Eat 30+ different plant foods weekly to maximize microbial diversity"
      },
      {
        topic: "Circadian Biology",
        fact: "Light exposure within 2 hours of waking sets your biological clock",
        implication: "Morning light deficiency disrupts sleep-wake cycles and hormone production",
        actionable: "Get 10-30 minutes of natural sunlight within 2 hours of waking"
      }
    ];

    const selectedBite = scienceBites[Math.floor(Math.random() * scienceBites.length)];

    const textBlock = `🧬 SNACK-SIZED SCIENCE

📚 THE RESEARCH: ${selectedBite.fact}

⚡ WHY IT MATTERS: ${selectedBite.implication}

🎯 ACTION STEP: ${selectedBite.actionable}`;

    const caption = `Quick science insights you can use today. Which research finding changed how you think about health?`;

    const visualCard = await this.generateScienceCard(selectedBite);

    return {
      templateId: 'snack-science',
      title: `Science Bite: ${selectedBite.topic}`,
      textBlock,
      caption,
      visualCard,
      scheduledFor: this.getNextScheduleDate('WED,FRI')
    };
  }

  /**
   * Generate Mini-Challenge content
   */
  private async generateMiniChallengeContent(): Promise<SeriesContent> {
    const challenges = [
      {
        day: 1,
        challenge: "Take 10 deep breaths when you feel stressed",
        why: "Activates parasympathetic nervous system, reducing cortisol",
        tip: "Breathe in for 4, hold for 4, exhale for 6"
      },
      {
        day: 2,
        challenge: "Drink a glass of water upon waking",
        why: "Kickstarts metabolism and rehydrates after 8+ hours without fluids",
        tip: "Add lemon for vitamin C and improved absorption"
      },
      {
        day: 3,
        challenge: "Stand and stretch every hour at work",
        why: "Counteracts sitting damage and improves circulation",
        tip: "Set hourly phone reminders until it becomes automatic"
      }
    ];

    const selectedChallenge = challenges[Math.floor(Math.random() * challenges.length)];

    const textBlock = `🏃‍♀️ 30-DAY MINI-CHALLENGE

DAY ${selectedChallenge.day}: ${selectedChallenge.challenge}

🧠 THE SCIENCE: ${selectedChallenge.why}

💡 PRO TIP: ${selectedChallenge.tip}

Ready to build this healthy habit? Small changes compound into big results.`;

    const caption = `Day ${selectedChallenge.day} of building healthier habits, one tiny action at a time. What's your current healthy habit streak?`;

    const visualCard = await this.generateChallengeCard(selectedChallenge);

    return {
      templateId: 'mini-challenge',
      title: `Day ${selectedChallenge.day} Challenge`,
      textBlock,
      caption,
      visualCard,
      scheduledFor: new Date()
    };
  }

  /**
   * Generate SVG card for Myth Monday (shadow mode zero-cost visual)
   */
  private async generateMythMondayCard(myth: any): Promise<string> {
    const config = getConfig();
    
    if (config.MODE === 'shadow') {
      // Zero-cost SVG generation for shadow mode
      return `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#f8f9fa" stroke="#e9ecef" stroke-width="2"/>
        <text x="20" y="40" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#dc3545">🚫 MYTH MONDAY</text>
        <text x="20" y="80" font-family="Arial, sans-serif" font-size="14" fill="#495057">${myth.myth.substring(0, 50)}...</text>
        <text x="20" y="120" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#28a745">✅ TRUTH:</text>
        <text x="20" y="145" font-family="Arial, sans-serif" font-size="11" fill="#495057">${myth.truth.substring(0, 60)}...</text>
        <text x="20" y="200" font-family="Arial, sans-serif" font-size="10" fill="#6c757d">Evidence-based health insights</text>
      </svg>`;
    } else {
      // Live mode would use proper image generation service
      return 'https://placeholder.image/myth-monday-card';
    }
  }

  /**
   * Generate SVG card for Science content
   */
  private async generateScienceCard(bite: any): Promise<string> {
    const config = getConfig();
    
    if (config.MODE === 'shadow') {
      return `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#e3f2fd" stroke="#1976d2" stroke-width="2"/>
        <text x="20" y="40" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1976d2">🧬 SNACK-SIZED SCIENCE</text>
        <text x="20" y="80" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333">${bite.topic}</text>
        <text x="20" y="120" font-family="Arial, sans-serif" font-size="12" fill="#555">${bite.fact.substring(0, 60)}...</text>
        <text x="20" y="180" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#1976d2">🎯 ACTION:</text>
        <text x="20" y="205" font-family="Arial, sans-serif" font-size="10" fill="#555">${bite.actionable.substring(0, 50)}...</text>
      </svg>`;
    } else {
      return 'https://placeholder.image/science-card';
    }
  }

  /**
   * Generate SVG card for Challenge content
   */
  private async generateChallengeCard(challenge: any): Promise<string> {
    const config = getConfig();
    
    if (config.MODE === 'shadow') {
      return `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#fff3e0" stroke="#f57c00" stroke-width="2"/>
        <text x="20" y="40" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#f57c00">🏃‍♀️ MINI-CHALLENGE</text>
        <text x="20" y="80" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#333">DAY ${challenge.day}</text>
        <text x="20" y="120" font-family="Arial, sans-serif" font-size="12" fill="#555">${challenge.challenge}</text>
        <text x="20" y="160" font-family="Arial, sans-serif" font-size="10" fill="#777">💡 ${challenge.tip.substring(0, 50)}...</text>
        <text x="20" y="250" font-family="Arial, sans-serif" font-size="10" fill="#f57c00">Small steps, big results</text>
      </svg>`;
    } else {
      return 'https://placeholder.image/challenge-card';
    }
  }

  /**
   * Get next scheduled date for a template
   */
  private getNextScheduleDate(schedule: string): Date {
    const now = new Date();
    
    if (schedule === 'MON') {
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + (1 + 7 - now.getDay()) % 7);
      return nextMonday;
    }
    
    if (schedule === 'WED,FRI') {
      const dayOfWeek = now.getDay();
      let daysToAdd = 0;
      
      if (dayOfWeek < 3) { // Before Wednesday
        daysToAdd = 3 - dayOfWeek;
      } else if (dayOfWeek < 5) { // Before Friday
        daysToAdd = 5 - dayOfWeek;
      } else { // After Friday, next Wednesday
        daysToAdd = (3 + 7 - dayOfWeek) % 7;
      }
      
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + daysToAdd);
      return nextDate;
    }
    
    if (schedule === 'DAILY') {
      return now;
    }
    
    return now;
  }

  /**
   * Get available series templates
   */
  public getAvailableTemplates(): SeriesTemplate[] {
    return SERIES_TEMPLATES;
  }

  /**
   * Check if a template should run today
   */
  public shouldRunToday(templateId: string): boolean {
    const template = SERIES_TEMPLATES.find(t => t.id === templateId);
    if (!template) return false;

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    switch (template.schedule) {
      case 'MON':
        return dayOfWeek === 1;
      case 'WED,FRI':
        return dayOfWeek === 3 || dayOfWeek === 5;
      case 'DAILY':
        return true;
      default:
        return false;
    }
  }
}
