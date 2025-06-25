-- Fix remaining database issues for news_articles table
-- Issues: published_at NOT NULL constraint and numeric field overflow

-- 1. Make published_at column nullable with default
ALTER TABLE news_articles 
ALTER COLUMN published_at DROP NOT NULL;

-- Add default value for published_at when it's missing
ALTER TABLE news_articles 
ALTER COLUMN published_at SET DEFAULT NOW();

-- 2. Fix numeric field overflow issues
-- Increase size of numeric fields that might overflow
ALTER TABLE news_articles 
ALTER COLUMN health_tech_relevance TYPE DECIMAL(5,2);

ALTER TABLE news_articles 
ALTER COLUMN credibility_score TYPE INTEGER;

-- 3. Update existing NULL published_at records
UPDATE news_articles 
SET published_at = created_at 
WHERE published_at IS NULL;

-- 4. Add data validation function to prevent future issues
CREATE OR REPLACE FUNCTION validate_news_article_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure published_at is not null
    IF NEW.published_at IS NULL THEN
        NEW.published_at := COALESCE(NEW.created_at, NOW());
    END IF;
    
    -- Ensure numeric fields are within valid ranges
    IF NEW.health_tech_relevance IS NOT NULL THEN
        NEW.health_tech_relevance := GREATEST(0, LEAST(100, NEW.health_tech_relevance));
    END IF;
    
    IF NEW.credibility_score IS NOT NULL THEN
        NEW.credibility_score := GREATEST(0, LEAST(100, NEW.credibility_score));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-validate data on insert/update
DROP TRIGGER IF EXISTS validate_news_article_trigger ON news_articles;
CREATE TRIGGER validate_news_article_trigger
    BEFORE INSERT OR UPDATE ON news_articles
    FOR EACH ROW
    EXECUTE FUNCTION validate_news_article_data();

-- Success confirmation
SELECT 'All database constraint issues fixed successfully!' as result; 