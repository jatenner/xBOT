// Mock Supabase client before any imports
jest.mock('../src/utils/supabaseClient', () => ({
  supabaseClient: {
    supabase: {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          data: null,
          error: null
        })
      })
    }
  }
}));

import { NewsAPIAgent } from '../src/agents/newsAPIAgent';

describe('NewsAPIAgent database insertion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not throw when article data lacks required fields', async () => {
    const agent = NewsAPIAgent.getInstance();
    
    // Mock the private method by accessing it through any
    const storeMethod = (agent as any).storeArticlesInDatabase;
    
    // Create articles with missing/undefined fields
    const articlesWithMissingData = [
      {
        title: undefined,
        url: '',
        source: null,
        apiSource: undefined,
        credibilityScore: undefined,
        healthTechRelevance: null,
        category: undefined,
        publishedAt: null
      }
    ];

    // Should not throw
    await expect(storeMethod.call(agent, articlesWithMissingData)).resolves.not.toThrow();
  });

  it('should handle missing news_articles table gracefully', async () => {
    const agent = NewsAPIAgent.getInstance();
    
    // Mock table not found error directly on the method
    const supabaseClient = require('../src/utils/supabaseClient').supabaseClient;
    supabaseClient.supabase.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        data: null,
        error: { message: 'relation "news_articles" does not exist' }
      })
    });
    
    const storeMethod = (agent as any).storeArticlesInDatabase;
    const validArticles = [{
      title: 'Test Article',
      url: 'https://example.com'
    }];

    // Should not throw even when table doesn't exist
    await expect(storeMethod.call(agent, validArticles)).resolves.not.toThrow();
  });

  it('should handle duplicate key errors silently', async () => {
    const agent = NewsAPIAgent.getInstance();
    
    // Mock duplicate key error
    const supabaseClient = require('../src/utils/supabaseClient').supabaseClient;
    supabaseClient.supabase.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' }
      })
    });
    
    const storeMethod = (agent as any).storeArticlesInDatabase;
    const validArticles = [{
      title: 'Test Article',
      url: 'https://example.com'
    }];

    // Should not throw on duplicate key errors
    await expect(storeMethod.call(agent, validArticles)).resolves.not.toThrow();
  });
});
