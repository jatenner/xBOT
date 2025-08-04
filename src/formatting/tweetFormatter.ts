/**
 * 🎨 TWEET FORMATTER
 * ==================
 * Advanced formatting system for clear, engaging, and visually appealing tweets
 */

export interface FormattingOptions {
  use_threads: boolean;
  max_tweet_length: number;
  use_emojis: boolean;
  use_line_breaks: boolean;
  use_numbering: boolean;
  visual_hierarchy: boolean;
}

export interface FormattedTweetResult {
  tweets: string[];
  is_thread: boolean;
  total_tweets: number;
  formatting_applied: string[];
  visual_score: number;
}

export class TweetFormatter {
  private static instance: TweetFormatter;

  private constructor() {}

  static getInstance(): TweetFormatter {
    if (!TweetFormatter.instance) {
      TweetFormatter.instance = new TweetFormatter();
    }
    return TweetFormatter.instance;
  }

  /**
   * 🎨 FORMAT CONTENT FOR OPTIMAL READABILITY
   */
  formatContent(content: string, options: FormattingOptions = this.getDefaultOptions()): FormattedTweetResult {
    try {
      console.log('🎨 Formatting content for optimal readability...');

      // Detect if content should be a thread
      const shouldBeThread = this.shouldBeThread(content);
      
      if (shouldBeThread && options.use_threads) {
        return this.formatAsThread(content, options);
      } else {
        return this.formatAsSingleTweet(content, options);
      }

    } catch (error) {
      console.error('❌ Failed to format content:', error);
      return {
        tweets: [content],
        is_thread: false,
        total_tweets: 1,
        formatting_applied: ['error_fallback'],
        visual_score: 0
      };
    }
  }

  /**
   * 🧵 FORMAT AS THREAD
   */
  private formatAsThread(content: string, options: FormattingOptions): FormattedTweetResult {
    const tweets: string[] = [];
    const formattingApplied: string[] = [];

    // Parse content into logical sections
    const sections = this.parseContentSections(content);
    
    // Create thread starter
    const threadStarter = this.createThreadStarter(sections[0], options);
    tweets.push(threadStarter);
    formattingApplied.push('thread_starter');

    // Create numbered thread tweets
    for (let i = 1; i < sections.length; i++) {
      const threadTweet = this.createThreadTweet(sections[i], i + 1, sections.length, options);
      tweets.push(threadTweet);
      formattingApplied.push(`thread_part_${i + 1}`);
    }

    // Add thread conclusion if needed
    if (sections.length > 3) {
      const conclusion = this.createThreadConclusion(options);
      tweets.push(conclusion);
      formattingApplied.push('thread_conclusion');
    }

    return {
      tweets,
      is_thread: true,
      total_tweets: tweets.length,
      formatting_applied: formattingApplied,
      visual_score: this.calculateVisualScore(tweets)
    };
  }

  /**
   * 📝 FORMAT AS SINGLE TWEET
   */
  private formatAsSingleTweet(content: string, options: FormattingOptions): FormattedTweetResult {
    const formattingApplied: string[] = [];
    let formattedContent = content;

    // Apply visual hierarchy
    if (options.visual_hierarchy) {
      formattedContent = this.applyVisualHierarchy(formattedContent);
      formattingApplied.push('visual_hierarchy');
    }

    // Add strategic line breaks
    if (options.use_line_breaks) {
      formattedContent = this.addStrategicLineBreaks(formattedContent);
      formattingApplied.push('line_breaks');
    }

    // Add strategic emojis
    if (options.use_emojis) {
      formattedContent = this.addStrategicEmojis(formattedContent);
      formattingApplied.push('strategic_emojis');
    }

    // Ensure proper length
    if (formattedContent.length > options.max_tweet_length) {
      formattedContent = this.trimToLength(formattedContent, options.max_tweet_length);
      formattingApplied.push('length_trimmed');
    }

    return {
      tweets: [formattedContent],
      is_thread: false,
      total_tweets: 1,
      formatting_applied: formattingApplied,
      visual_score: this.calculateVisualScore([formattedContent])
    };
  }

  /**
   * 🧵 CREATE THREAD STARTER
   */
  private createThreadStarter(firstSection: string, options: FormattingOptions): string {
    let starter = '';

    // Add thread indicator
    starter += '🧵 THREAD:\n\n';

    // Add compelling hook
    const hook = this.extractHook(firstSection);
    starter += `${hook}\n\n`;

    // Add preview of what's coming
    starter += '👇 Why this matters for your health...\n\n';
    starter += '1/🧵';

    return starter;
  }

  /**
   * 📍 CREATE THREAD TWEET
   */
  private createThreadTweet(section: string, number: number, total: number, options: FormattingOptions): string {
    let tweet = '';

    // Add number indicator
    tweet += `${number}/🧵\n\n`;

    // Format the section content
    const formattedSection = this.formatSectionContent(section, options);
    tweet += formattedSection;

    // Add continuation hint if not last
    if (number < total) {
      tweet += '\n\n👇';
    }

    return tweet;
  }

  /**
   * 🎯 CREATE THREAD CONCLUSION
   */
  private createThreadConclusion(options: FormattingOptions): string {
    const conclusions = [
      '🎯 TAKEAWAY:\n\nQuestion everything. Research for yourself. Your health is your responsibility.\n\nWhat\'s your experience with this? 👇',
      '💡 BOTTOM LINE:\n\nDon\'t trust everything you hear - even from experts. Do your own research.\n\nThoughts? Disagree? Let me know! 👇',
      '🚀 ACTION STEP:\n\nStart questioning these "facts" and see how your health improves.\n\nTry it and share your results! 👇'
    ];

    return conclusions[Math.floor(Math.random() * conclusions.length)];
  }

  /**
   * 🔍 SHOULD BE THREAD?
   */
  private shouldBeThread(content: string): boolean {
    // Indicators that content should be threaded
    const threadIndicators = [
      content.length > 200,
      content.includes('1/') || content.includes('2/') || content.includes('3/'),
      content.includes('Here\'s why:'),
      content.includes('Studies show'),
      (content.match(/\d+\)/g) || []).length >= 3, // 3+ numbered points
      content.split('.').length > 4, // 4+ sentences
      content.includes('THREAD') || content.includes('🧵')
    ];

    return threadIndicators.filter(Boolean).length >= 2;
  }

  /**
   * 📑 PARSE CONTENT SECTIONS
   */
  private parseContentSections(content: string): string[] {
    const sections: string[] = [];

    // Split by numbered points
    if (content.match(/\d+[\.)]/g)) {
      const parts = content.split(/\d+[\.)]\s*/);
      sections.push(parts[0]); // Intro
      sections.push(...parts.slice(1).filter(part => part.trim()));
    }
    // Split by sentences for long content
    else if (content.split('.').length > 4) {
      const sentences = content.split('.').filter(s => s.trim());
      const intro = sentences.slice(0, 2).join('.') + '.';
      sections.push(intro);
      
      // Group remaining sentences
      for (let i = 2; i < sentences.length; i += 2) {
        const section = sentences.slice(i, i + 2).join('.') + '.';
        if (section.trim()) sections.push(section);
      }
    }
    // Split by "Here's why" or similar
    else {
      const splitPoints = ['Here\'s why:', 'Studies show', 'The truth is', 'But here\'s'];
      let foundSplit = false;
      
      for (const splitPoint of splitPoints) {
        if (content.includes(splitPoint)) {
          const parts = content.split(splitPoint);
          sections.push(parts[0].trim());
          sections.push(splitPoint + ' ' + parts[1].trim());
          foundSplit = true;
          break;
        }
      }
      
      if (!foundSplit) {
        // Fallback: split by length
        const midPoint = Math.floor(content.length / 2);
        const splitIndex = content.lastIndexOf('.', midPoint);
        if (splitIndex > 0) {
          sections.push(content.substring(0, splitIndex + 1));
          sections.push(content.substring(splitIndex + 1));
        } else {
          sections.push(content);
        }
      }
    }

    return sections.filter(section => section.trim().length > 0);
  }

  /**
   * 🎨 APPLY VISUAL HIERARCHY
   */
  private applyVisualHierarchy(content: string): string {
    let formatted = content;

    // Add visual breaks for "Here's why"
    formatted = formatted.replace(/Here's why:/g, '\n🔍 HERE\'S WHY:\n');
    
    // Format numbered points
    formatted = formatted.replace(/(\d+)[\.)]\s*/g, '\n$1️⃣ ');
    
    // Emphasize key phrases
    formatted = formatted.replace(/\bWRONG\b/g, '❌ WRONG');
    formatted = formatted.replace(/\bMyth\b/g, '🚫 MYTH');
    formatted = formatted.replace(/\bTruth\b/g, '✅ TRUTH');
    formatted = formatted.replace(/\bStudies show\b/g, '📊 STUDIES SHOW');

    return formatted;
  }

  /**
   * 📏 ADD STRATEGIC LINE BREAKS
   */
  private addStrategicLineBreaks(content: string): string {
    let formatted = content;

    // Add breaks before questions
    formatted = formatted.replace(/(\?)\s*([A-Z])/g, '$1\n\n$2');
    
    // Add breaks after strong statements
    formatted = formatted.replace(/(completely wrong|myth|truth|dangerous)\./gi, '$1.\n\n');
    
    // Add breaks before "But" statements
    formatted = formatted.replace(/\.\s*(But\s+)/g, '.\n\n$1');

    return formatted;
  }

  /**
   * 😊 ADD STRATEGIC EMOJIS
   */
  private addStrategicEmojis(content: string): string {
    let formatted = content;

    // Health-related emojis
    const emojiMap = {
      'sleep': '😴',
      'energy': '⚡',
      'nutrition': '🥗',
      'exercise': '💪',
      'brain': '🧠',
      'heart': '❤️',
      'doctor': '👨‍⚕️',
      'pharmaceutical': '💊',
      'natural': '🌿',
      'sunlight': '☀️',
      'vitamin': '💊'
    };

    for (const [word, emoji] of Object.entries(emojiMap)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (formatted.match(regex) && !formatted.includes(emoji)) {
        formatted = formatted.replace(regex, `${word} ${emoji}`);
        break; // Only add one emoji per tweet
      }
    }

    return formatted;
  }

  /**
   * 🎯 EXTRACT HOOK
   */
  private extractHook(content: string): string {
    // Find the most engaging sentence
    const sentences = content.split('.').map(s => s.trim()).filter(s => s);
    
    // Look for questions first
    const questions = sentences.filter(s => s.includes('?'));
    if (questions.length > 0) {
      return questions[0] + '?';
    }

    // Look for controversial statements
    const controversial = sentences.filter(s => 
      s.toLowerCase().includes('wrong') || 
      s.toLowerCase().includes('myth') || 
      s.toLowerCase().includes('lie')
    );
    if (controversial.length > 0) {
      return controversial[0] + '.';
    }

    // Default to first sentence
    return sentences[0] + '.';
  }

  /**
   * 📝 FORMAT SECTION CONTENT
   */
  private formatSectionContent(section: string, options: FormattingOptions): string {
    let formatted = section.trim();

    // Add visual hierarchy
    if (options.visual_hierarchy) {
      formatted = this.applyVisualHierarchy(formatted);
    }

    // Add strategic emojis
    if (options.use_emojis) {
      formatted = this.addStrategicEmojis(formatted);
    }

    // Ensure proper ending
    if (!formatted.endsWith('.') && !formatted.endsWith('!') && !formatted.endsWith('?')) {
      formatted += '.';
    }

    return formatted;
  }

  /**
   * ✂️ TRIM TO LENGTH
   */
  private trimToLength(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // Find the last complete sentence within limit
    const trimmed = content.substring(0, maxLength - 3);
    const lastPeriod = trimmed.lastIndexOf('.');
    const lastExclamation = trimmed.lastIndexOf('!');
    const lastQuestion = trimmed.lastIndexOf('?');
    
    const lastPunctuation = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastPunctuation > maxLength * 0.7) { // If we can keep 70% of content
      return trimmed.substring(0, lastPunctuation + 1);
    }

    return trimmed + '...';
  }

  /**
   * 📊 CALCULATE VISUAL SCORE
   */
  private calculateVisualScore(tweets: string[]): number {
    let score = 0;

    for (const tweet of tweets) {
      // Points for line breaks
      score += (tweet.match(/\n/g) || []).length * 0.5;
      
      // Points for emojis (not too many)
      const emojiCount = (tweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
      score += Math.min(emojiCount, 3) * 0.5;
      
      // Points for structure
      if (tweet.includes('🧵') || tweet.includes('/')) score += 1;
      if (tweet.includes('👇')) score += 0.5;
      
      // Points for visual hierarchy
      if (tweet.includes('HERE\'S WHY') || tweet.includes('TRUTH') || tweet.includes('MYTH')) score += 1;
    }

    return Math.min(10, score);
  }

  /**
   * ⚙️ GET DEFAULT OPTIONS
   */
  private getDefaultOptions(): FormattingOptions {
    return {
      use_threads: true,
      max_tweet_length: 280,
      use_emojis: true,
      use_line_breaks: true,
      use_numbering: true,
      visual_hierarchy: true
    };
  }

  /**
   * 🔄 REFORMAT EXISTING TWEET
   */
  reformatExistingTweet(tweetContent: string): FormattedTweetResult {
    console.log('🔄 Reformatting existing tweet...');
    
    // Clean up the content first
    let cleaned = tweetContent
      .replace(/\s+/g, ' ') // Remove extra spaces
      .replace(/\n+/g, ' ') // Remove random line breaks
      .trim();

    // Apply formatting
    return this.formatContent(cleaned);
  }
}

export const tweetFormatter = TweetFormatter.getInstance();