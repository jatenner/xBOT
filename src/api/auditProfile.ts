/**
 * 📋 AUDIT PROFILE ENDPOINT
 * Simple profile checklist and recommended pinned tweet
 */

import { Request, Response } from 'express';

export interface ProfileAudit {
  checklist: {
    item: string;
    status: 'complete' | 'needs_attention' | 'missing';
    recommendation?: string;
  }[];
  pinnedTweetRecommendation: {
    text: string;
    reasoning: string;
  };
  profileOptimizations: {
    bio: string;
    location: string;
    website: string;
  };
}

export function auditProfileHandler(req: Request, res: Response): void {
  try {
    const audit: ProfileAudit = {
      checklist: [
        {
          item: "Profile picture shows clear, professional health-focused imagery",
          status: "complete",
          recommendation: "Use high-quality image that conveys health expertise"
        },
        {
          item: "Bio clearly states health focus and value proposition",
          status: "complete",
          recommendation: "Include keywords: evidence-based, health insights, wellness"
        },
        {
          item: "Pinned tweet showcases best health content",
          status: "needs_attention",
          recommendation: "Pin high-engagement educational thread or key health insight"
        },
        {
          item: "Location set to target audience region",
          status: "complete",
          recommendation: "Use broad location like 'United States' for wider reach"
        },
        {
          item: "Website link drives to health resource or landing page",
          status: "complete",
          recommendation: "Link to valuable health resources, not just homepage"
        },
        {
          item: "Consistent posting schedule (3-5 posts/day)",
          status: "complete",
          recommendation: "Maintain regular posting to maximize algorithm visibility"
        },
        {
          item: "Engaging with health community daily",
          status: "needs_attention",
          recommendation: "Reply to 5-10 relevant health posts daily to build relationships"
        },
        {
          item: "Using health-relevant hashtags strategically",
          status: "complete",
          recommendation: "Mix popular (#health) and niche (#biohacking) hashtags"
        }
      ],
      pinnedTweetRecommendation: {
        text: `🧬 5 health "facts" that surprised me as a researcher:

1. Your gut produces 90% of your body's serotonin
2. Cold exposure can increase brown fat by 40%
3. Blue light after sunset disrupts melatonin for 3+ hours
4. Walking after meals reduces blood sugar spikes by 30%
5. Social isolation impacts mortality risk equal to smoking

Which one surprised you most? 🧵`,
        reasoning: "Thread format encourages engagement, combines authority positioning with surprising facts, and includes a clear call-to-action for replies. The numbered format is highly shareable."
      },
      profileOptimizations: {
        bio: "Evidence-based health insights 🧬 | Researcher sharing science you can use | Daily tips for optimal wellness | DM for collaboration",
        location: "United States",
        website: "linktr.ee/healthinsights"
      }
    };

    res.json({
      success: true,
      audit,
      completionScore: calculateCompletionScore(audit.checklist),
      timestamp: new Date().toISOString(),
      nextActions: getNextActions(audit.checklist)
    });

  } catch (error) {
    console.error('❌ AUDIT_PROFILE_ENDPOINT: Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate profile audit',
      timestamp: new Date().toISOString()
    });
  }
}

function calculateCompletionScore(checklist: ProfileAudit['checklist']): number {
  const completed = checklist.filter(item => item.status === 'complete').length;
  return Math.round((completed / checklist.length) * 100);
}

function getNextActions(checklist: ProfileAudit['checklist']): string[] {
  return checklist
    .filter(item => item.status !== 'complete')
    .map(item => item.recommendation || item.item)
    .slice(0, 3); // Top 3 priorities
}
