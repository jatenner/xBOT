-- Fix for missing api_source column in news_articles table
-- This column is expected by the NewsAPIAgent but missing from schema

-- Add api_source column to existing news_articles table
ALTER TABLE news_articles 
ADD COLUMN IF NOT EXISTS api_source VARCHAR(50) DEFAULT 'unknown';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_news_articles_api_source ON news_articles(api_source);

-- Update existing records to have a default api_source
UPDATE news_articles 
SET api_source = 'legacy' 
WHERE api_source IS NULL OR api_source = '';

-- Add comment for documentation
COMMENT ON COLUMN news_articles.api_source IS 'Source API: newsapi, guardian, mediastack, newsdata, fallback';

SELECT 'api_source column added successfully to news_articles table' as result; 