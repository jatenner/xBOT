#!/usr/bin/env node

/**
 * 🚨 EMERGENCY VIRAL TRANSFORMATION FIX
 * =====================================
 * 
 * CRITICAL ISSUES IDENTIFIED:
 * 1. Bot generating academic research content instead of viral tweets
 * 2. Burst posting (12 tweets at once) instead of distributed posting
 * 3. Zero engagement because content is not followable/shareable
 * 
 * This script FORCES viral content generation and distributed posting
 */

const { createClient } = require('@supabase/supabase-js');

async function emergencyViralTransformation() {
  console.log('🚨 EMERGENCY VIRAL TRANSFORMATION FIX');
  console.log('====================================');
  
  const supabaseUrl = process.env.SUPABASE_URL || "https://qtgjmaelglghnlahqpbl.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYwNjUxMCwiZXhwIjoyMDY1MTgyNTEwfQ.Gze-MRjDg592T02LpyTlyXt14QkiIgRFgvnMeUchUfU";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('🔥 1. FORCING VIRAL CONTENT GENERATION...');
    
    // FORCE VIRAL CONTENT DISTRIBUTION
    await supabase
      .from('bot_config')
      .upsert({
        key: 'enhanced_content_distribution',
        value: {
          distribution: {
            viral_content: 60,      // 60% viral content (was 10%)
            breaking_news: 20,      // 20% breaking news reactions
            hot_takes: 15,          // 15% controversial hot takes
            expert_intelligence: 3, // 3% expert content (was 30%)
            comprehensive_analysis: 2 // 2% academic (was high)
          },
          enabled: true,
          force_viral: true,
          academic_content_disabled: true
        }
      });

    console.log('✅ Content distribution: 60% viral, 20% breaking news, 15% hot takes');

    console.log('🔥 2. FORCING VIRAL TEMPLATES...');
    
    // FORCE VIRAL HOOK TEMPLATES
    await supabase
      .from('bot_config')
      .upsert({
        key: 'attention_hook_mandates',
        value: {
          enabled: true,
          mandatory_hooks: true,
          hook_types: [
            "Hot take:",
            "Unpopular opinion:",
            "Plot twist:",
            "Nobody talks about this but",
            "What they don't tell you:",
            "The truth about",
            "Why everyone's wrong about",
            "🚨 Breaking:",
            "Wild stat:",
            "This will blow your mind:"
          ],
          min_hook_usage: 80 // 80% of posts must use hooks
        }
      });

    console.log('✅ Viral hooks: Hot take, Unpopular opinion, Plot twist activated');

    console.log('🔥 3. FORCING CONTROVERSIAL CONTENT...');
    
    // FORCE CONTROVERSIAL ENGAGEMENT
    await supabase
      .from('bot_config')
      .upsert({
        key: 'controversial_content_mandates',
        value: {
          enabled: true,
          controversial_percentage: 40,
          hot_take_percentage: 30,
          debate_starter_percentage: 20,
          personality_content_percentage: 10,
          controversial_topics: [
            "AI health apps are making people less healthy",
            "Your doctor is probably wrong about vitamins",
            "The healthcare industry doesn't want you healthy",
            "Most health advice is completely backwards",
            "Wearable devices are just expensive anxiety creators",
            "Traditional medicine is failing modern patients",
            "Health influencers are doing more harm than good",
            "Your morning routine is probably ruining your health"
          ]
        }
      });

    console.log('✅ Controversial content: 40% controversial, 30% hot takes');

    console.log('🔥 4. FIXING BURST POSTING PROBLEM...');
    
    // FORCE DISTRIBUTED POSTING SCHEDULE
    await supabase
      .from('bot_config')
      .upsert({
        key: 'distributed_posting_schedule',
        value: {
          enabled: true,
          anti_burst_protection: true,
          max_posts_per_hour: 1,        // Only 1 post per hour
          min_interval_minutes: 120,     // 2 hours minimum between posts
          daily_posting_windows: [
            { hour: 8, minute: 0, weight: 0.15 },   // 8:00 AM
            { hour: 10, minute: 30, weight: 0.12 }, // 10:30 AM
            { hour: 13, minute: 0, weight: 0.15 },  // 1:00 PM
            { hour: 15, minute: 30, weight: 0.12 }, // 3:30 PM
            { hour: 17, minute: 0, weight: 0.15 },  // 5:00 PM
            { hour: 19, minute: 30, weight: 0.18 }, // 7:30 PM (peak)
            { hour: 21, minute: 0, weight: 0.13 }   // 9:00 PM
          ],
          total_daily_posts: 7,
          burst_posting_disabled: true,
          catchup_posting_disabled: true
        }
      });

    console.log('✅ Distributed posting: 7 posts/day, 2-hour spacing, NO BURST POSTING');

    console.log('🔥 5. FORCING VIRAL ENGAGEMENT STRATEGIES...');
    
    // FORCE VIRAL ENGAGEMENT TACTICS
    await supabase
      .from('bot_config')
      .upsert({
        key: 'viral_engagement_tactics',
        value: {
          enabled: true,
          engagement_hooks: [
            "Thoughts?",
            "What's your take?",
            "Am I wrong?",
            "Change my mind",
            "Agree or disagree?",
            "Who else has noticed this?",
            "Anyone else feel this way?",
            "Thread 👇",
            "More on this tomorrow",
            "Should I share more?"
          ],
          viral_elements: {
            use_numbers: true,           // "3 things", "90% of people"
            use_comparisons: true,       // "vs", "better than"
            use_urgency: true,          // "right now", "today"
            use_social_proof: true,     // "everyone's doing"
            use_controversy: true,      // challenge beliefs
            use_stories: true          // personal anecdotes
          },
          thread_starters: 50,          // 50% chance to tease threads
          call_to_action: 30           // 30% include engagement CTAs
        }
      });

    console.log('✅ Viral tactics: Engagement hooks, numbers, controversy, stories');

    console.log('🔥 6. DISABLING ACADEMIC CONTENT...');
    
    // DISABLE ACADEMIC/RESEARCH HEAVY CONTENT
    await supabase
      .from('bot_config')
      .upsert({
        key: 'academic_content_restriction',
        value: {
          enabled: true,
          max_academic_percentage: 5,    // Only 5% academic content
          forbidden_phrases: [
            "Recent studies demonstrate",
            "Research indicates that",
            "According to the literature",
            "Clinical trials have shown",
            "Evidence suggests",
            "Scientific consensus",
            "Peer-reviewed research",
            "Meta-analysis reveals",
            "Systematic review",
            "Longitudinal study"
          ],
          required_personality_elements: [
            "personal experience",
            "real-world observations", 
            "practical insights",
            "contrarian views",
            "behind-the-scenes",
            "controversial takes"
          ]
        }
      });

    console.log('✅ Academic content: DISABLED - No more research papers!');

    console.log('🔥 7. FORCING FOLLOWER GROWTH CONTENT...');
    
    // FORCE FOLLOWER GROWTH STRATEGIES
    await supabase
      .from('bot_config')
      .upsert({
        key: 'follower_growth_content',
        value: {
          enabled: true,
          follow_worthy_content_percentage: 70,
          content_types: {
            behind_scenes: 25,      // "What they don't tell you"
            hot_takes: 30,          // "Unpopular opinion"
            personal_stories: 20,   // "3 years ago I learned"
            value_bombs: 15,        // "Free tools that work"
            controversy: 10         // Debate starters
          },
          follow_triggers: [
            "More insights like this daily",
            "Follow for daily health truths",
            "I share stuff like this regularly", 
            "More controversial takes coming",
            "Daily dose of health reality",
            "Follow for unfiltered health takes"
          ]
        }
      });

    console.log('✅ Follower growth: Behind-scenes, hot takes, personal stories');

    console.log('🔥 8. UPDATING POSTING FREQUENCY...');
    
    // UPDATE OVERALL POSTING STRATEGY
    await supabase
      .from('bot_config')
      .upsert({
        key: 'optimal_posting_strategy',
        value: {
          strategy: 'viral_growth_distributed',
          daily_target: 7,
          max_hourly: 1,
          min_spacing_minutes: 120,
          peak_times: [8, 13, 17, 19],  // 8AM, 1PM, 5PM, 7PM
          content_priority: 'engagement_over_accuracy',
          viral_optimization: true,
          academic_minimization: true
        }
      });

    console.log('✅ Posting strategy: 7 tweets/day, 2-hour spacing, viral priority');

    console.log('🎯 9. FINAL VERIFICATION...');
    
    // Verify all configurations
    const configs = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', [
        'enhanced_content_distribution',
        'attention_hook_mandates', 
        'controversial_content_mandates',
        'distributed_posting_schedule',
        'viral_engagement_tactics',
        'academic_content_restriction',
        'follower_growth_content',
        'optimal_posting_strategy'
      ]);

    if (configs.data && configs.data.length === 8) {
      console.log('✅ ALL 8 VIRAL CONFIGURATIONS APPLIED SUCCESSFULLY');
    } else {
      console.warn('⚠️ Some configurations may not have been applied correctly');
    }

    console.log('');
    console.log('🎉 VIRAL TRANSFORMATION COMPLETE!');
    console.log('=================================');
    console.log('');
    console.log('📊 EXPECTED CHANGES:');
    console.log('• Content: "Hot take: Everyone\'s obsessing over AI health..." (NOT research papers)');
    console.log('• Schedule: 7 posts spread across day (NOT 12 posts at once)');
    console.log('• Engagement: Controversial takes that drive replies/follows');
    console.log('• Style: Personal stories, behind-scenes, debate starters');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('1. Monitor new deployment logs for viral content generation');
    console.log('2. Watch for distributed posting (posts 2+ hours apart)');
    console.log('3. Look for engagement hooks: "Hot take:", "Unpopular opinion:"');
    console.log('4. Expect follower growth within 24-48 hours');
    console.log('');
    console.log('⚡ This should solve both the academic content AND burst posting issues!');

  } catch (error) {
    console.error('❌ Emergency viral transformation failed:', error);
    process.exit(1);
  }
}

// Run the emergency fix
emergencyViralTransformation(); 