const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

class DiverseAIPostingSystem {
    constructor() {
        this.client = new TwitterApi({
            appKey: process.env.TWITTER_APP_KEY,
            appSecret: process.env.TWITTER_APP_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });
        
        this.contentAgents = [];
        this.isRunning = false;
        this.lastTopics = new Set();
        this.postCount = 0;
        
        this.initializeAIAgents();
    }
    
    async initializeAIAgents() {
        try {
            console.log('🧠 Initializing AI content generation system...');
            
            // Import built AI agents
            const { UltraViralGenerator } = await import('./dist/agents/ultraViralGenerator.js');
            const { CreativeContentAgent } = await import('./dist/agents/creativeContentAgent.js');
            const { ComprehensiveContentAgent } = await import('./dist/agents/comprehensiveContentAgent.js');
            const { ViralContentAgent } = await import('./dist/agents/viralContentAgent.js');
            
            this.ultraViral = new UltraViralGenerator();
            this.creativeAgent = new CreativeContentAgent();
            this.comprehensiveAgent = new ComprehensiveContentAgent();
            this.viralAgent = new ViralContentAgent();
            
            console.log('✅ Ultra Viral Generator loaded');
            console.log('✅ Creative Content Agent loaded');
            console.log('✅ Comprehensive Content Agent loaded');
            console.log('✅ Viral Content Agent loaded');
            
            this.contentStyles = [
                'BREAKTHROUGH_DISCOVERY',
                'HIDDEN_ELITE_TECH', 
                'WILD_DATA_REVEAL',
                'OPTIMIZATION_HACK',
                'TECH_DISRUPTION',
                'BIOHACKING_SECRET',
                'PERFORMANCE_BREAKTHROUGH',
                'HOT_TAKE_CONTROVERSIAL',
                'INSIDER_INTEL',
                'URGENT_ALERT'
            ];
            
            this.healthTopics = [
                'AI drug discovery',
                'precision medicine', 
                'digital therapeutics',
                'brain-computer interfaces',
                'gene therapy',
                'robotic surgery',
                'telemedicine',
                'health monitoring',
                'longevity research',
                'medical imaging AI',
                'biomarker detection',
                'personalized treatment',
                'rare disease research',
                'cancer immunotherapy',
                'mental health AI',
                'fitness tracking',
                'medical devices',
                'health data privacy',
                'wearable technology',
                'AI diagnostics'
            ];
            
        } catch (error) {
            console.log('⚠️ AI agents failed to load:', error.message);
            console.log('🔄 Using diverse fallback content system...');
            this.setupFallbackSystem();
        }
    }
    
    setupFallbackSystem() {
        this.diverseTemplates = [
            "🚨 BREAKTHROUGH: {tech} just achieved {result} in clinical trials. {impact} for {field}. This could revolutionize {application}. #HealthTech #Innovation",
            "📊 WILD DATA: New study shows {treatment} increased {metric} by {percentage}% in {demographic}. Cost: {price} vs traditional {expensive_option}. Game-changer. #MedTech",
            "💡 HOT TAKE: {controversial_statement} about {field}. {supporting_data}. {provocative_question} #HealthDebate",
            "🔍 INSIDER INTEL: What {industry} doesn't want you to know about {technology}. {hidden_benefit} could save {outcome}. #HealthcareSecrets",
            "⚡ OPTIMIZATION HACK: {technique} improved {outcome} by {percentage}% vs {standard}. Available for {price}. Goodbye {expensive_alternative}. #Biohacking",
            "🚀 DISRUPTION: {company} just made {expensive_service} available for {fraction} of the cost. {specific_benefit}. {industry} is scrambling. #HealthDisruption",
            "🧬 GENE THERAPY UPDATE: {specific_advance} shows {promising_result} for {condition}. {trial_data}. {timeline} for public availability. #GeneTherapy",
            "🤖 AI BREAKTHROUGH: New algorithm {specific_capability} with {accuracy}% accuracy. {comparison_to_humans}. {implementation_timeline}. #MedicalAI",
            "💊 DRUG DISCOVERY: AI reduced development time from {old_time} to {new_time} for {condition}. {cost_savings}. {patient_impact}. #DrugDevelopment",
            "🏥 TELEMEDICINE: {specific_innovation} enables {capability} remotely. {effectiveness_data}. {accessibility_improvement}. #Telemedicine"
        ];
        
        this.diverseTopics = [
            { topic: 'CRISPR gene editing', tech: 'prime editing', result: '99.7% accuracy', field: 'genetic diseases' },
            { topic: 'AI diagnostics', tech: 'deep learning', result: '94% accuracy vs 78% doctors', field: 'radiology' },
            { topic: 'digital therapeutics', tech: 'VR therapy', result: '68% reduction in anxiety', field: 'mental health' },
            { topic: 'biomarker detection', tech: 'liquid biopsy', result: '2-year early cancer detection', field: 'oncology' },
            { topic: 'robotic surgery', tech: 'haptic feedback', result: '40% fewer complications', field: 'cardiac surgery' },
            { topic: 'precision medicine', tech: 'pharmacogenomics', result: '2.5x better outcomes', field: 'drug response' },
            { topic: 'brain interfaces', tech: 'neural implants', result: '96% control accuracy', field: 'paralysis treatment' },
            { topic: 'longevity research', tech: 'senolytic drugs', result: '20% lifespan extension', field: 'aging reversal' },
            { topic: 'wearable monitoring', tech: 'continuous glucose', result: '40% better diabetes control', field: 'metabolic health' },
            { topic: 'mental health AI', tech: 'sentiment analysis', result: '85% depression prediction', field: 'preventive psychiatry' }
        ];
    }
    
    async start() {
        console.log('🚀 DIVERSE AI POSTING SYSTEM STARTED');
        console.log('=====================================');
        console.log('🎨 10 different content styles active');
        console.log('🔬 20+ health tech topics in rotation');
        console.log('🧠 AI-powered content generation');
        console.log('⏰ Intelligent timing optimization');
        
        this.isRunning = true;
        
        // Post first diverse tweet immediately
        await this.postDiverseTweet();
        
        // Then post with AI-determined intervals
        this.startIntelligentPosting();
        
        console.log('✅ Diverse posting system active - no more repetitive content!');
    }
    
    async startIntelligentPosting() {
        while (this.isRunning) {
            try {
                // AI determines optimal wait time (45-180 minutes for diverse, engaging content)
                const waitMinutes = this.calculateOptimalWaitTime();
                console.log(`🕐 Next diverse tweet in ${waitMinutes} minutes`);
                
                await this.sleep(waitMinutes * 60000);
                
                if (this.isRunning) {
                    await this.postDiverseTweet();
                }
                
            } catch (error) {
                console.log('❌ Posting cycle error:', error.message);
                await this.sleep(60 * 60000); // 1 hour fallback
            }
        }
    }
    
    calculateOptimalWaitTime() {
        // Intelligent timing based on engagement patterns
        const hour = new Date().getHours();
        const baseWait = 90; // 1.5 hours base
        
        // Peak engagement times get shorter intervals
        if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16) || (hour >= 19 && hour <= 21)) {
            return baseWait - 30; // 60 minutes during peak
        }
        
        // Off-peak gets longer intervals
        if (hour >= 23 || hour <= 6) {
            return baseWait + 90; // 3 hours during night
        }
        
        return baseWait;
    }
    
    async postDiverseTweet() {
        try {
            let content = '';
            let contentSource = 'fallback';
            
            // Try AI-generated content first
            if (this.ultraViral) {
                try {
                    console.log('🎨 Generating AI content...');
                    
                    // Ensure topic diversity - don't repeat recent topics
                    const availableTopics = this.healthTopics.filter(topic => !this.lastTopics.has(topic));
                    if (availableTopics.length === 0) {
                        this.lastTopics.clear(); // Reset if all used
                        availableTopics.push(...this.healthTopics);
                    }
                    
                    const selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
                    const selectedStyle = this.contentStyles[Math.floor(Math.random() * this.contentStyles.length)];
                    
                    this.lastTopics.add(selectedTopic);
                    if (this.lastTopics.size > 5) {
                        const firstTopic = this.lastTopics.values().next().value;
                        this.lastTopics.delete(firstTopic);
                    }
                    
                    const viralContent = await this.ultraViral.generateViralTweet(selectedTopic, selectedStyle);
                    content = viralContent.content;
                    contentSource = `AI-${selectedStyle}`;
                    
                    console.log(`🧠 Generated ${selectedStyle} about ${selectedTopic}`);
                    
                } catch (aiError) {
                    console.log('⚠️ AI generation failed, using creative fallback:', aiError.message);
                    content = this.generateCreativeFallback();
                    contentSource = 'creative_fallback';
                }
            } else {
                content = this.generateCreativeFallback();
                contentSource = 'diverse_fallback';
            }
            
            console.log(`\n📤 Posting diverse tweet (#${this.postCount + 1}):`);
            console.log(`📝 Source: ${contentSource}`);
            console.log(`📄 Content: ${content.substring(0, 100)}...`);
            console.log(`📏 Length: ${content.length} characters`);
            
            const result = await this.client.v2.tweet(content);
            
            console.log(`✅ Diverse tweet posted successfully!`);
            console.log(`🔗 Tweet ID: ${result.data.id}`);
            console.log(`⏰ Posted at: ${new Date().toISOString()}`);
            
            this.postCount++;
            
            // Save to database
            await this.saveTweetToDatabase(result.data.id, content, contentSource);
            
        } catch (error) {
            console.log('❌ Failed to post diverse tweet:', error.message);
        }
    }
    
    generateCreativeFallback() {
        const template = this.diverseTemplates[Math.floor(Math.random() * this.diverseTemplates.length)];
        const topicData = this.diverseTopics[Math.floor(Math.random() * this.diverseTopics.length)];
        
        // Advanced template substitution with creative data
        let content = template
            .replace('{tech}', topicData.tech || 'AI technology')
            .replace('{result}', topicData.result || '95% success rate')
            .replace('{field}', topicData.field || 'healthcare')
            .replace('{impact}', 'Revolutionary breakthrough')
            .replace('{application}', 'patient care')
            .replace('{treatment}', 'new therapy')
            .replace('{metric}', 'outcomes')
            .replace('{percentage}', Math.floor(Math.random() * 80) + 20)
            .replace('{price}', ['$99', '$199', '$299', '$49'][Math.floor(Math.random() * 4)])
            .replace('{expensive_option}', ['$5,000 clinics', '$10,000 procedures', '$2,000/month treatments'][Math.floor(Math.random() * 3)])
            .replace('{controversial_statement}', 'Traditional healthcare will be obsolete within 5 years')
            .replace('{company}', ['Stanford', 'MIT', 'Google Health', 'Apple'][Math.floor(Math.random() * 4)])
            .replace('{demographic}', ['adults 35+', 'patients with diabetes', 'athletes', 'seniors'][Math.floor(Math.random() * 4)])
            .replace('{condition}', ['rare diseases', 'cancer', 'Alzheimer\'s', 'heart disease'][Math.floor(Math.random() * 4)])
            .replace('{accuracy}', Math.floor(Math.random() * 15) + 85)
            .replace('{industry}', ['Big Pharma', 'healthcare systems', 'medical device companies'][Math.floor(Math.random() * 3)])
            .replace('{technology}', topicData.topic || 'health technology')
            .replace('{hidden_benefit}', 'breakthrough innovation')
            .replace('{outcome}', 'thousands of lives')
            .replace('{technique}', 'new protocol')
            .replace('{standard}', 'traditional methods')
            .replace('{expensive_alternative}', 'costly procedures')
            .replace('{expensive_service}', 'premium healthcare')
            .replace('{fraction}', '1/10th')
            .replace('{specific_benefit}', 'improved outcomes')
            .replace('{specific_advance}', 'breakthrough therapy')
            .replace('{promising_result}', 'remarkable success')
            .replace('{trial_data}', '87% efficacy in trials')
            .replace('{timeline}', '2025')
            .replace('{specific_capability}', 'diagnoses conditions')
            .replace('{comparison_to_humans}', 'vs 78% doctor accuracy')
            .replace('{implementation_timeline}', 'Rolling out nationwide')
            .replace('{old_time}', '10 years')
            .replace('{new_time}', '18 months')
            .replace('{cost_savings}', '$2.3B in R&D costs saved')
            .replace('{patient_impact}', 'Faster access to life-saving treatments')
            .replace('{specific_innovation}', 'new platform')
            .replace('{capability}', 'real-time monitoring')
            .replace('{effectiveness_data}', '94% patient satisfaction')
            .replace('{accessibility_improvement}', 'Available to rural communities');
            
        return content;
    }
    
    async saveTweetToDatabase(tweetId, content, source) {
        try {
            const { exec } = require('child_process');
            exec(`node save_posted_tweet_to_database.js ${tweetId} "${content}" "${source}"`, (error, stdout, stderr) => {
                if (error) {
                    console.log('⚠️ Database save failed:', error.message);
                } else {
                    console.log('💾 Tweet saved to database');
                }
            });
        } catch (error) {
            console.log('⚠️ Database save error:', error.message);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    stop() {
        this.isRunning = false;
        console.log('🛑 Diverse AI posting system stopped');
    }
    
    getStats() {
        return {
            postsGenerated: this.postCount,
            topicsUsed: this.lastTopics.size,
            systemStatus: this.isRunning ? 'active' : 'stopped',
            aiAgentsLoaded: !!this.ultraViral
        };
    }
}

// Start the diverse posting system
const diverseBot = new DiverseAIPostingSystem();
diverseBot.start().catch(console.error);

// Keep the process running
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, stopping diverse posting system...');
    diverseBot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, stopping diverse posting system...');
    diverseBot.stop();
    process.exit(0);
});