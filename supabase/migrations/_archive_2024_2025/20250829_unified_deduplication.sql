-- 🔍 UNIFIED DEDUPLICATION MIGRATION
-- Implements content deduplication on unified_posts table
-- Prevents duplicate content from being posted

-- =============================================================================
-- 📊 ADD SIMILARITY HASH TO UNIFIED POSTS
-- =============================================================================

-- Add similarity_hash column to unified_posts
ALTER TABLE unified_posts 
ADD COLUMN IF NOT EXISTS similarity_hash TEXT;

-- =============================================================================
-- 🔧 SIMILARITY HASH CALCULATION FUNCTION
-- =============================================================================

-- Create function to calculate similarity hash (copy from previous migration)
CREATE OR REPLACE FUNCTION calculate_similarity_hash(content_text TEXT)
RETURNS TEXT AS $$
DECLARE
    cleaned_content TEXT;
    hash_value TEXT;
BEGIN
    -- Clean and normalize content
    cleaned_content := LOWER(TRIM(content_text));
    
    -- Remove common punctuation and normalize whitespace
    cleaned_content := REGEXP_REPLACE(cleaned_content, '[^\w\s]', '', 'g');
    cleaned_content := REGEXP_REPLACE(cleaned_content, '\s+', ' ', 'g');
    
    -- Remove common words that don't affect similarity
    cleaned_content := REGEXP_REPLACE(cleaned_content, '\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|up|about|into|through|during|before|after|above|below|between|among|since|until|while|because|if|when|where|how|what|which|who|why|this|that|these|those|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|hers|its|our|their)\b', '', 'gi');
    
    -- Generate SHA256 hash of cleaned content
    hash_value := encode(digest(cleaned_content, 'sha256'), 'hex');
    
    RETURN hash_value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- ⚡ TRIGGERS FOR AUTOMATIC HASH CALCULATION
-- =============================================================================

-- Create trigger function to automatically calculate similarity hash
CREATE OR REPLACE FUNCTION trigger_calculate_similarity_hash()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate similarity hash for new or updated content
    NEW.similarity_hash := calculate_similarity_hash(NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on unified_posts
DROP TRIGGER IF EXISTS trg_unified_posts_similarity ON unified_posts;
CREATE TRIGGER trg_unified_posts_similarity
    BEFORE INSERT OR UPDATE OF content ON unified_posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_similarity_hash();

-- =============================================================================
-- 🛡️ DUPLICATE PREVENTION INDEXES
-- =============================================================================

-- Create partial unique index to prevent exact duplicates within 24 hours
-- (allows same content after 24 hours for legitimate reposts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_posts_simhash_day 
ON unified_posts (similarity_hash, DATE(posted_at))
WHERE similarity_hash IS NOT NULL;

-- Create index for fast similarity lookups
CREATE INDEX IF NOT EXISTS idx_unified_posts_similarity_hash 
ON unified_posts (similarity_hash) 
WHERE similarity_hash IS NOT NULL;

-- Create index for content duplicate checks
CREATE INDEX IF NOT EXISTS idx_unified_posts_content_check 
ON unified_posts USING gin(to_tsvector('english', content));

-- =============================================================================
-- 📋 UNIFIED CONTENT HASHES VIEW
-- =============================================================================

-- Create view that shows all content hashes for duplicate checking
CREATE OR REPLACE VIEW unified_content_hashes AS
SELECT 
    post_id,
    content,
    similarity_hash,
    posted_at,
    post_type,
    thread_id,
    'unified_posts' as source_table,
    LENGTH(content) as content_length,
    ai_strategy
FROM unified_posts
WHERE similarity_hash IS NOT NULL
ORDER BY posted_at DESC;

-- =============================================================================
-- 🔍 DUPLICATE DETECTION FUNCTIONS
-- =============================================================================

-- Function to check for duplicate content before posting
CREATE OR REPLACE FUNCTION check_content_duplicate(
    content_text TEXT,
    hours_back INTEGER DEFAULT 24
) RETURNS TABLE(
    is_duplicate BOOLEAN,
    similar_post_id TEXT,
    similarity_hash TEXT,
    posted_at TIMESTAMP,
    hours_ago NUMERIC
) AS $$
DECLARE
    input_hash TEXT;
    cutoff_time TIMESTAMP;
BEGIN
    -- Calculate hash for input content
    input_hash := calculate_similarity_hash(content_text);
    cutoff_time := NOW() - INTERVAL '%s hours' FORMAT (hours_back);
    
    -- Check for duplicates in unified_posts
    RETURN QUERY
    SELECT 
        TRUE as is_duplicate,
        up.post_id,
        up.similarity_hash,
        up.posted_at,
        EXTRACT(EPOCH FROM (NOW() - up.posted_at)) / 3600.0 as hours_ago
    FROM unified_posts up
    WHERE up.similarity_hash = input_hash
      AND up.posted_at >= cutoff_time
    ORDER BY up.posted_at DESC
    LIMIT 1;
    
    -- If no duplicates found, return false
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            FALSE as is_duplicate,
            NULL::TEXT as similar_post_id,
            input_hash as similarity_hash,
            NULL::TIMESTAMP as posted_at,
            NULL::NUMERIC as hours_ago;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get content similarity score
CREATE OR REPLACE FUNCTION get_content_similarity_score(
    content1 TEXT,
    content2 TEXT
) RETURNS DECIMAL(5,4) AS $$
DECLARE
    hash1 TEXT;
    hash2 TEXT;
    word_similarity DECIMAL(5,4);
BEGIN
    -- Calculate hashes
    hash1 := calculate_similarity_hash(content1);
    hash2 := calculate_similarity_hash(content2);
    
    -- Exact hash match = 1.0 similarity
    IF hash1 = hash2 THEN
        RETURN 1.0;
    END IF;
    
    -- Calculate word-level similarity using PostgreSQL similarity
    SELECT similarity(content1, content2) INTO word_similarity;
    
    RETURN COALESCE(word_similarity, 0.0);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 🔄 BACKFILL EXISTING DATA
-- =============================================================================

-- Update existing unified_posts with similarity hashes
DO $$
DECLARE
    post_record RECORD;
    total_posts INTEGER;
    processed_posts INTEGER := 0;
BEGIN
    -- Get total count for progress tracking
    SELECT COUNT(*) INTO total_posts FROM unified_posts WHERE similarity_hash IS NULL;
    
    IF total_posts > 0 THEN
        RAISE NOTICE 'Backfilling similarity hashes for % posts...', total_posts;
        
        -- Process in batches to avoid long locks
        FOR post_record IN 
            SELECT id, content 
            FROM unified_posts 
            WHERE similarity_hash IS NULL 
            ORDER BY posted_at DESC
        LOOP
            UPDATE unified_posts 
            SET similarity_hash = calculate_similarity_hash(post_record.content)
            WHERE id = post_record.id;
            
            processed_posts := processed_posts + 1;
            
            -- Progress update every 100 posts
            IF processed_posts % 100 = 0 THEN
                RAISE NOTICE 'Processed % of % posts...', processed_posts, total_posts;
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Completed backfilling % similarity hashes', total_posts;
    END IF;
END $$;

-- =============================================================================
-- 🧹 CLEANUP FUNCTIONS
-- =============================================================================

-- Function to remove old duplicate entries (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_duplicates()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete posts older than 30 days that have newer duplicates
    WITH duplicate_groups AS (
        SELECT 
            similarity_hash,
            MIN(posted_at) as first_posted,
            MAX(posted_at) as last_posted,
            COUNT(*) as duplicate_count
        FROM unified_posts
        WHERE similarity_hash IS NOT NULL
          AND posted_at < NOW() - INTERVAL '30 days'
        GROUP BY similarity_hash
        HAVING COUNT(*) > 1
    ),
    posts_to_delete AS (
        SELECT up.id
        FROM unified_posts up
        JOIN duplicate_groups dg ON up.similarity_hash = dg.similarity_hash
        WHERE up.posted_at = dg.first_posted  -- Keep the newest, delete the oldest
          AND dg.duplicate_count > 1
    )
    DELETE FROM unified_posts
    WHERE id IN (SELECT id FROM posts_to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old duplicate posts', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 📊 DUPLICATE STATISTICS VIEW
-- =============================================================================

-- Create view for duplicate statistics and monitoring
CREATE OR REPLACE VIEW duplicate_prevention_stats AS
SELECT 
    COUNT(*) as total_posts,
    COUNT(DISTINCT similarity_hash) as unique_content_hashes,
    COUNT(*) - COUNT(DISTINCT similarity_hash) as potential_duplicates,
    ROUND(
        (COUNT(DISTINCT similarity_hash)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as uniqueness_percentage,
    MAX(posted_at) as latest_post,
    MIN(posted_at) as earliest_post
FROM unified_posts
WHERE similarity_hash IS NOT NULL;

-- =============================================================================
-- ⏰ AUTOMATED MAINTENANCE
-- =============================================================================

-- Schedule cleanup of old duplicates (if pg_cron is available)
DO $$
BEGIN
    -- Try to schedule cleanup, but don't fail if pg_cron is not available
    BEGIN
        PERFORM cron.schedule(
            'cleanup-old-duplicates',
            '0 3 * * 0', -- Weekly on Sunday at 3 AM
            'SELECT cleanup_old_duplicates();'
        );
        RAISE NOTICE 'Scheduled automatic duplicate cleanup';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron not available - manual cleanup required';
    END;
END $$;

-- =============================================================================
-- ✅ MIGRATION COMPLETE
-- =============================================================================

-- Log successful completion
INSERT INTO unified_ai_intelligence (
    decision_type, recommendation, confidence, reasoning, data_points_used
) VALUES (
    'system_update',
    '{"type": "deduplication_enabled", "status": "active", "features": ["similarity_hash", "duplicate_prevention", "automatic_cleanup"]}',
    1.0,
    'Unified deduplication system successfully deployed with similarity hashing and duplicate prevention',
    (SELECT COUNT(*) FROM unified_posts)
);

-- Final status report
DO $$
DECLARE
    stats_record RECORD;
BEGIN
    SELECT * INTO stats_record FROM duplicate_prevention_stats;
    
    RAISE NOTICE '🔍 UNIFIED DEDUPLICATION MIGRATION COMPLETE';
    RAISE NOTICE '✅ Added similarity_hash column and triggers';
    RAISE NOTICE '🛡️ Created duplicate prevention indexes';
    RAISE NOTICE '📋 Created unified_content_hashes view';
    RAISE NOTICE '🔧 Added duplicate detection functions';
    RAISE NOTICE '📊 Posts: %, Unique: %, Duplicates: %', 
        stats_record.total_posts, 
        stats_record.unique_content_hashes, 
        stats_record.potential_duplicates;
    RAISE NOTICE '✅ Deduplication system fully operational';
END $$;
