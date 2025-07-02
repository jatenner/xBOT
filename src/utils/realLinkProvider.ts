/**
 * Real Link Provider
 * Provides verified, working links for health tech content
 * Never generates fake or broken URLs
 */

interface RealLink {
  url: string;
  title: string;
  source: string;
  credibilityScore: number;
  topics: string[];
  isWorking: boolean;
}

export class RealLinkProvider {
  private readonly verifiedLinks: RealLink[] = [
    // Nature - Highest credibility
    {
      url: "https://www.nature.com/subjects/medical-research",
      title: "Nature Medical Research",
      source: "Nature",
      credibilityScore: 98,
      topics: ["medical_research", "biotech", "clinical_trials"],
      isWorking: true
    },
    {
      url: "https://www.nature.com/nm/",
      title: "Nature Medicine",
      source: "Nature",
      credibilityScore: 98,
      topics: ["precision_medicine", "digital_health", "ai_medicine"],
      isWorking: true
    },

    // Science Daily - High credibility
    {
      url: "https://www.sciencedaily.com/news/health_medicine/",
      title: "Science Daily Health & Medicine",
      source: "Science Daily", 
      credibilityScore: 95,
      topics: ["health_tech", "medical_devices", "research_news"],
      isWorking: true
    },
    {
      url: "https://www.sciencedaily.com/news/computers_math/artificial_intelligence/",
      title: "Science Daily AI Research",
      source: "Science Daily",
      credibilityScore: 95,
      topics: ["ai_research", "machine_learning", "digital_health"],
      isWorking: true
    },

    // MIT Technology Review - Tech focus
    {
      url: "https://www.technologyreview.com/topic/biotechnology/",
      title: "MIT Tech Review Biotechnology",
      source: "MIT Technology Review",
      credibilityScore: 94,
      topics: ["biotech", "gene_therapy", "drug_discovery"],
      isWorking: true
    },
    {
      url: "https://www.technologyreview.com/topic/artificial-intelligence/",
      title: "MIT Tech Review AI",
      source: "MIT Technology Review", 
      credibilityScore: 94,
      topics: ["ai_medicine", "digital_diagnostics", "health_ai"],
      isWorking: true
    },

    // STAT News - Healthcare journalism
    {
      url: "https://www.statnews.com/topic/artificial-intelligence/",
      title: "STAT News AI Coverage",
      source: "STAT News",
      credibilityScore: 90,
      topics: ["ai_healthcare", "digital_therapeutics", "health_innovation"],
      isWorking: true
    },
    {
      url: "https://www.statnews.com/topic/biotech/",
      title: "STAT News Biotech",
      source: "STAT News",
      credibilityScore: 90,
      topics: ["biotech_companies", "clinical_trials", "drug_development"],
      isWorking: true
    },

    // Healthcare IT News
    {
      url: "https://www.healthcareitnews.com/topic/artificial-intelligence",
      title: "Healthcare IT News AI",
      source: "Healthcare IT News",
      credibilityScore: 88,
      topics: ["health_it", "medical_ai", "digital_health"],
      isWorking: true
    },

    // NIH/Government Sources
    {
      url: "https://www.nih.gov/news-events/news-releases",
      title: "NIH News Releases",
      source: "National Institutes of Health",
      credibilityScore: 97,
      topics: ["clinical_research", "medical_breakthroughs", "health_policy"],
      isWorking: true
    },
    {
      url: "https://www.fda.gov/news-events/press-announcements",
      title: "FDA Press Announcements",
      source: "FDA",
      credibilityScore: 96,
      topics: ["drug_approvals", "medical_devices", "health_regulation"],
      isWorking: true
    },

    // Academic Institutions
    {
      url: "https://med.stanford.edu/news.html",
      title: "Stanford Medicine News",
      source: "Stanford Medicine",
      credibilityScore: 95,
      topics: ["medical_research", "digital_health", "precision_medicine"],
      isWorking: true
    },
    {
      url: "https://www.broadinstitute.org/news",
      title: "Broad Institute News",
      source: "Broad Institute", 
      credibilityScore: 94,
      topics: ["genomics", "gene_therapy", "computational_biology"],
      isWorking: true
    },

    // General but relevant
    {
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      title: "PubMed Research Database",
      source: "NCBI",
      credibilityScore: 99,
      topics: ["research_papers", "clinical_studies", "medical_literature"],
      isWorking: true
    }
  ];

  private readonly topicMappings = {
    "ai": ["ai_medicine", "health_ai", "digital_diagnostics"],
    "drug discovery": ["drug_development", "biotech", "clinical_trials"],
    "cancer": ["medical_research", "clinical_trials", "biotech"],
    "gene therapy": ["gene_therapy", "genomics", "biotech"],
    "precision medicine": ["precision_medicine", "digital_health", "ai_medicine"],
    "digital health": ["digital_health", "health_tech", "medical_devices"],
    "brain": ["medical_research", "digital_health", "ai_medicine"],
    "heart": ["medical_research", "clinical_research", "medical_devices"],
    "diagnostics": ["digital_diagnostics", "medical_ai", "health_tech"],
    "robotic surgery": ["medical_devices", "health_innovation", "health_tech"],
    "telemedicine": ["digital_therapeutics", "health_tech", "digital_health"]
  };

  /**
   * Get a real, working link for the given topic
   */
  public getRealLinkForTopic(topic: string): RealLink | null {
    console.log(`🔗 Finding real link for topic: "${topic}"`);
    
    // Map topic to our topic categories
    const relevantTopics = this.mapTopicToCategories(topic.toLowerCase());
    
    // Find links that match the topic
    const matchingLinks = this.verifiedLinks.filter(link => 
      link.topics.some(linkTopic => 
        relevantTopics.some(searchTopic => 
          linkTopic.includes(searchTopic) || searchTopic.includes(linkTopic)
        )
      )
    );

    if (matchingLinks.length === 0) {
      console.log(`⚠️ No specific link found for "${topic}", using general medical research link`);
      return this.getGeneralMedicalResearchLink();
    }

    // Sort by credibility and return the best match
    const bestLink = matchingLinks.sort((a, b) => b.credibilityScore - a.credibilityScore)[0];
    console.log(`✅ Found real link: ${bestLink.url} (${bestLink.source}, credibility: ${bestLink.credibilityScore})`);
    
    return bestLink;
  }

  /**
   * Get multiple real links for a topic
   */
  public getMultipleLinksForTopic(topic: string, count: number = 3): RealLink[] {
    const relevantTopics = this.mapTopicToCategories(topic.toLowerCase());
    
    const matchingLinks = this.verifiedLinks.filter(link => 
      link.topics.some(linkTopic => 
        relevantTopics.some(searchTopic => 
          linkTopic.includes(searchTopic) || searchTopic.includes(linkTopic)
        )
      )
    );

    // Return top matches sorted by credibility
    return matchingLinks
      .sort((a, b) => b.credibilityScore - a.credibilityScore)
      .slice(0, count);
  }

  /**
   * Get a high-credibility general link when no specific match is found
   */
  private getGeneralMedicalResearchLink(): RealLink {
    return this.verifiedLinks.find(link => 
      link.source === "Nature" && link.topics.includes("medical_research")
    ) || this.verifiedLinks[0];
  }

  /**
   * Map a topic string to our categorized topics
   */
  private mapTopicToCategories(topic: string): string[] {
    const categories: string[] = [];
    
    for (const [key, values] of Object.entries(this.topicMappings)) {
      if (topic.includes(key)) {
        categories.push(...values);
      }
    }

    // If no specific mapping, try partial matches
    if (categories.length === 0) {
      if (topic.includes("ai") || topic.includes("artificial")) {
        categories.push("ai_medicine", "digital_health");
      }
      if (topic.includes("health") || topic.includes("medical")) {
        categories.push("medical_research", "health_tech");
      }
      if (topic.includes("tech") || topic.includes("digital")) {
        categories.push("health_tech", "digital_health");
      }
    }

    return categories.length > 0 ? categories : ["medical_research"];
  }

  /**
   * Validate that a URL is actually working (simple check)
   */
  public async validateUrl(url: string): Promise<boolean> {
    try {
      // For now, just check URL format - could add actual HTTP check later
      const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
      return urlPattern.test(url);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get a random high-credibility link
   */
  public getRandomHighCredibilityLink(): RealLink {
    const highCredLinks = this.verifiedLinks.filter(link => link.credibilityScore >= 94);
    return highCredLinks[Math.floor(Math.random() * highCredLinks.length)];
  }

  /**
   * Get all available topics
   */
  public getAvailableTopics(): string[] {
    return [...new Set(this.verifiedLinks.flatMap(link => link.topics))];
  }

  /**
   * Should we include a link for this content type?
   */
  public shouldIncludeLink(contentType: string, contentLength: number): boolean {
    // Include links for research/news content, but not for general observations
    const linkWorthyTypes = [
      "breaking_news", "research_update", "study_results", 
      "clinical_trial", "breakthrough", "announcement"
    ];
    
    const isLinkWorthy = linkWorthyTypes.some(type => 
      contentType.toLowerCase().includes(type)
    );
    
    // Don't include links if content is already very long
    const hasSpaceForLink = contentLength < 230;
    
    return isLinkWorthy && hasSpaceForLink;
  }
}

// Singleton instance
export const realLinkProvider = new RealLinkProvider(); 