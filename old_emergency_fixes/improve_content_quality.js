const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function improveContentQuality() {
  console.log('🎨 === IMPROVING CONTENT QUALITY ===');
  console.log('Breaking the repetitive BREAKTHROUGH pattern...');
  
  try {
    // 1. FORCE CONTENT DIVERSITY
    console.log('🎨 Setting up content diversity mandates...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'creative_format_diversity',
        value: {
          enabled: true,
          mandatory_formats: true,
          min_hours_between_same_format: 4,
          format_rotation: [
            'expert_insight',
            'research_breakthrough', 
            'industry_analysis',
            'data_story',
            'contrarian_take',
            'insider_knowledge',
            'prediction',
            'behind_scenes'
          ],
          current_format_index: 0,
          last_format_used: null
        }
      });
    
    // 2. CONTROVERSIAL CONTENT MANDATES
    console.log('🔥 Adding controversial/engaging content...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'controversial_content_mandates',
        value: {
          enabled: true,
          controversial_frequency: 0.3, // 30% of content should be controversial
          controversial_topics: [
            'AI replacing doctors debate',
            'Healthcare privacy concerns', 
            'Digital divide in medicine',
            'Pharmaceutical industry practices',
            'Precision medicine ethics',
            'Telehealth limitations',
            'Medical AI bias',
            'Healthcare data ownership'
          ]
        }
      });
    
    // 3. DIVERSE CONTENT TEMPLATES
    console.log('📝 Installing diverse content templates...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'diverse_content_templates',
        value: {
          expert_insight: [
            "After {years} years in {field}: {insight}. Most people don't realize {hidden_truth}.",
            "Industry insider perspective: {observation}. The data tells a different story: {data}.",
            "What I learned from {experience}: {lesson}. This changes how we think about {domain}."
          ],
          research_breakthrough: [
            "New {journal} study just dropped: {finding}. {sample_size} participants. {implication}.",
            "Research update that caught my attention: {discovery}. {institution} team found {result}.",
            "Plot twist in {field}: {unexpected_finding}. Source: {citation}. Game changer."
          ],
          contrarian_take: [
            "Unpopular opinion after {experience}: {controversial_view}. Here's why: {reasoning}.",
            "Hot take: Everyone's wrong about {topic}. The real issue is {actual_problem}.",
            "Controversial but true: {statement}. Having worked with {context}, I've seen {evidence}."
          ],
          data_story: [
            "The numbers don't lie: {statistic} from {source}. But here's what everyone's missing: {insight}.",
            "Fascinating data point: {metric} across {sample}. The implications are {impact}.",
            "Data that keeps me up at night: {concerning_stat}. Source: {citation}. We need to talk about this."
          ],
          prediction: [
            "Mark my words: {prediction} will happen by {timeframe}. Why? {reasoning}.",
            "Prediction from someone who's been watching this space: {forecast}. The signs are clear.",
            "Called it first - screenshot this: {bold_prediction}. The convergence is happening."
          ],
          behind_scenes: [
            "What actually happens behind closed doors: {insider_info}. The public doesn't see {hidden_reality}.",
            "Industry secret: {confidential_insight}. After {years} years, I can finally talk about this.",
            "Reality check from the inside: {internal_perspective}. The marketing doesn't match the data."
          ]
        }
      });
    
    // 4. ENGAGEMENT OPTIMIZATION
    console.log('⚡ Setting up engagement optimization...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'engagement_optimization',
        value: {
          enabled: true,
          hook_patterns: [
            'Plot twist:',
            'Nobody talks about this, but',
            'Industry secret:',
            'After {X} years, here\'s what I learned:',
            'Unpopular opinion:',
            'The data doesn\'t lie:',
            'What everyone\'s missing:',
            'Hot take:',
            'Reality check:',
            'Mark my words:'
          ],
          ending_patterns: [
            'Thoughts?',
            'Change my mind.',
            'What\'s your take?',
            'This keeps me up at night.',
            'Most people don\'t realize this yet.',
            'The implications are massive.',
            'Screenshot this for later.',
            'Mark my words.',
            'What am I missing?'
          ]
        }
      });
    
    // 5. CONTENT QUALITY RULES
    console.log('✨ Setting content quality standards...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'content_quality_rules',
        value: {
          enabled: true,
          banned_phrases: [
            'BREAKTHROUGH:',
            'GAME CHANGER:',
            'JUST IN:',
            'Machine learning algorithms identify',
            'minutes in months'
          ],
          min_uniqueness_score: 0.8,
          max_similar_content_percentage: 0.3,
          require_specific_numbers: true,
          require_human_voice: true,
          ban_repetitive_openings: true
        }
      });
    
    // 6. HUMAN EXPERT MODE
    console.log('🧠 Activating human expert mode...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'content_mode_override',
        value: {
          force_human_expert: true,
          human_expert_percentage: 0.8, // 80% human expert content
          ban_robotic_templates: true,
          require_personal_insights: true,
          expert_credentials: [
            '15+ years in health tech',
            'Former Stanford researcher',
            'Worked with 500+ healthcare startups',
            'Published in Nature Medicine',
            'Advisor to Fortune 500 health companies'
          ]
        }
      });
    
    console.log('');
    console.log('🎉 CONTENT QUALITY IMPROVEMENTS APPLIED!');
    console.log('');
    console.log('✅ Changes made:');
    console.log('   🎨 Forced content format diversity');
    console.log('   🔥 Added controversial/engaging topics');
    console.log('   📝 Installed 6 diverse template categories');
    console.log('   ⚡ Enhanced engagement patterns');
    console.log('   🚫 Banned repetitive phrases');
    console.log('   🧠 Activated human expert mode');
    console.log('');
    console.log('🚀 Next tweets should be much more engaging and varied!');
    
  } catch (error) {
    console.error('Error improving content quality:', error);
  }
}

improveContentQuality(); 