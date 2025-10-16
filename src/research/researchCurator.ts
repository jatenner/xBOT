/**
 * RESEARCH CURATOR
 * Selects and prepares research context for generators
 */

import { getStudyDatabase, Study } from './studyDatabase';

export interface ResearchContext {
  finding: string;
  source: string;
  mechanism: string;
  sampleSize?: number;
  researcher?: string;
  hasResearch: boolean;
}

export class ResearchCurator {
  private static instance: ResearchCurator;
  
  private constructor() {}
  
  public static getInstance(): ResearchCurator {
    if (!ResearchCurator.instance) {
      ResearchCurator.instance = new ResearchCurator();
    }
    return ResearchCurator.instance;
  }
  
  /**
   * Curate research for topic
   */
  curateResearch(topic: string, useResearch: boolean = true): ResearchContext {
    if (!useResearch || Math.random() < 0.3) {
      // 30% of time, NO research (for variety/human feel)
      return {
        finding: '',
        source: '',
        mechanism: '',
        hasResearch: false
      };
    }
    
    const studyDb = getStudyDatabase();
    
    // 70% relevant study, 30% random (for diversity)
    const study = Math.random() < 0.7
      ? studyDb.findRelevantStudy(topic)
      : studyDb.getRandomStudy();
    
    if (!study) {
      return {
        finding: '',
        source: '',
        mechanism: '',
        hasResearch: false
      };
    }
    
    return this.formatStudyContext(study);
  }
  
  /**
   * Format study into context for generator
   */
  private formatStudyContext(study: Study): ResearchContext {
    return {
      finding: study.finding,
      source: `${study.institution} ${study.year} study (n=${study.sample_size})`,
      mechanism: study.mechanism,
      sampleSize: study.sample_size,
      researcher: study.researcher,
      hasResearch: true
    };
  }
  
  /**
   * Get citation string for study
   */
  getCitation(context: ResearchContext): string {
    if (!context.hasResearch) return '';
    
    return `Research: ${context.source}`;
  }
}

export const getResearchCurator = () => ResearchCurator.getInstance();

