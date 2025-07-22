export class EmbeddingFilter {
  constructor() {
    // Stub constructor
  }

  async filterContent(content: any[]): Promise<any[]> {
    console.log('🎯 EmbeddingFilter: filterContent called (stub)');
    return content;
  }

  async rankByRelevance(items: any[]): Promise<any[]> {
    console.log('🎯 EmbeddingFilter: rankByRelevance called (stub)');
    return items;
  }
} 