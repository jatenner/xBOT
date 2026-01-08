-- Add context_similarity and opportunity_score_final columns to reply_opportunities
-- These enable brand-anchor-based discovery and weighted final scoring

BEGIN;

-- Add context_similarity column (0-1 score from brand anchor matching)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reply_opportunities' AND column_name='context_similarity') THEN
        ALTER TABLE public.reply_opportunities ADD COLUMN context_similarity REAL NOT NULL DEFAULT 0.0;
        COMMENT ON COLUMN public.reply_opportunities.context_similarity IS 'Score (0-1) indicating similarity to brand anchor texts (sleep, training, nutrition, longevity, neuroscience, metabolism, recovery).';
    END IF;
END $$;

-- Add opportunity_score_final column (weighted final score)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reply_opportunities' AND column_name='opportunity_score_final') THEN
        ALTER TABLE public.reply_opportunities ADD COLUMN opportunity_score_final REAL NOT NULL DEFAULT 0.0;
        COMMENT ON COLUMN public.reply_opportunities.opportunity_score_final IS 'Final weighted score: 0.45*relevance + 0.25*replyability + 0.30*context_similarity';
    END IF;
END $$;

-- Add index for opportunity_score_final (used for ordering)
CREATE INDEX IF NOT EXISTS idx_reply_opps_score_final ON public.reply_opportunities(opportunity_score_final DESC);

COMMIT;

