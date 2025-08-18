# Social Content & Engagement Operator

Complete implementation of a human-like content generation system for health/performance Twitter profiles.

## 🎯 What It Does

Generates varied, thoughtful content and replies that feel read-and-thoughtful, learns from performance, and maintains safety/accuracy standards.

## 🚀 Quick Start

```bash
# Generate content for health brand with specific topics
npm run content:generate -- --brand health --seeds "sleep optimization,energy management"

# Quick content pack without analysis
npm run content:quick -- --topics "morning routines,productivity"

# Analyze past performance
npm run content:analyze -- --posts-file data/demo-recent-posts.json

# Different brand personalities
npm run content:health -- --seeds "circadian rhythm,recovery"
npm run content:productivity -- --seeds "focus,time management" 
npm run content:mindfulness -- --seeds "stress,meditation"
```

## 📊 Content Types Generated

### Singles (≤240 chars)
- **Hook-driven**: Numbers, personal results, counterintuitive insights
- **Actionable**: Specific micro-steps people can try today
- **No hashtags**: Clean, conversational style

### Threads (5-9 tweets)
- **Structured templates**: Checklist, myth vs fact, tiny experiments, 80/20 plays
- **One big idea**: Focused narrative with clear progression
- **Each tweet ≤220 chars**: Optimized for engagement

### Replies
- **Context-aware**: References specific details from original post
- **Value-adding**: Provides helpful insights or questions
- **Conversational**: Sounds like a human who actually read the post

## 🎨 Brand Profiles

### Health Performance
- **Voice**: Friendly coach who's been there
- **Focus**: Evidence-based optimization for busy professionals
- **Constraints**: No medical advice, qualified claims only

### Productivity
- **Voice**: Experienced colleague sharing what works
- **Focus**: Sustainable systems for knowledge workers
- **Constraints**: No hustle culture, work-life balance focus

### Mindfulness
- **Voice**: Gentle guide who understands the struggle
- **Focus**: Practical mental wellness for modern life
- **Constraints**: No spiritual preaching, inclusive approach

## 🎖️ Quality Gate (0-100 Rubric)

- **Hook Specificity** (25pts): Numbers, personal results, contrarian insights
- **Big Idea Focus** (15pts): One clear concept, not scattered
- **Actionability** (20pts): Specific micro-steps and timeframes
- **Novelty/Insight** (20pts): Counterintuitive, myth-busting, surprising
- **Readability** (10pts): Short sentences, clear structure
- **Human Tone** (10pts): Conversational, not lecture-style

**Thresholds:**
- ≥80: Publish immediately
- 70-79: Auto-revise once, then evaluate
- <70: Regenerate with different approach

## 📈 Performance Learning

Analyzes past posts to extract patterns:

- **High performers**: Personal results + numbers + specific timeframes
- **Low performers**: Generic advice, vague language, no actionables
- **A/B experiments**: Different hook styles, posting times, formats

## 🔧 Integration with xBOT

```typescript
import { ContentOrchestrator } from './src/content/ContentOrchestrator';

const orchestrator = new ContentOrchestrator('health');

// Generate single post
const single = await orchestrator.generateContent({
  type: 'single',
  topic: 'morning routines',
  brandType: 'health'
});

// Generate thread
const thread = await orchestrator.generateContent({
  type: 'thread', 
  topic: 'sleep optimization',
  brandType: 'health'
});

// Generate reply
const reply = await orchestrator.generateContent({
  type: 'reply',
  targetPost: {
    content: 'Struggling with energy levels...',
    author: 'HealthSeeker',
    context: 'energy levels'
  }
});
```

## 🧪 Testing

```bash
# Test quality gate scoring
npm run test:quality

# Test social content operator 
npm run test:content

# Test all new components
npm run test:clients test:lock test:browser test:reply
```

## 📋 Output Format

```
1) CONTENT PACK
- SINGLES (3)
  - S1: I fixed my afternoon energy crash in 2 weeks...
  - S2: Counterintuitive: the best time to exercise...
  - S3: Micro-step for better focus: Set a 25-minute timer...

- THREAD A [template = checklist]
  T1.1: The 5-minute morning routine that changed everything:
  T1.2: 1) 30 seconds: Feet on floor, 3 deep breaths
  T1.3: 2) 2 minutes: Sunlight exposure (even cloudy days)
  ...

2) REPLIES (6-10 targeted responses)
- R1 to @healthseeker ("energy levels"): Re: feeling exhausted...

3) COMMENT RESPONSES (6-10 for mentions)  
- C1 to @user123 ("really helpful"): Thanks! Glad this resonated...

4) LEARNING NOTES
- What to do more of: Include specific numbers and timeframes
- What to avoid: Generic advice without specifics
- Next experiments: Test myth vs fact vs tiny experiment formats
```

## 🚦 Safety & Compliance

- **No medical advice**: Uses qualified language ("may help", "research suggests")
- **Evidence-based**: Cites sources for research claims
- **Individual variation**: Acknowledges different needs and responses
- **Professional consultation**: Encourages healthcare provider consultation

## 📊 Analytics Integration

Tracks generated content performance:
- **Engagement rates**: Likes, replies, reposts, bookmarks per view
- **Hook effectiveness**: Which opening styles drive engagement
- **Topic performance**: What health/productivity topics resonate
- **Format comparison**: Single vs thread vs reply performance

The system continuously learns and improves content based on real performance data.
