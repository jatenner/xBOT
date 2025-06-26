const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'Snap2Health AI Bot - Diverse Content Intelligence Active',
        timestamp: new Date().toISOString(),
        features: [
            'Diverse AI Content Generation',
            'Multi-Style Content Creation', 
            'Dynamic Topic Rotation',
            'Real-Time Trend Analysis',
            'Autonomous Learning System'
        ]
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        ai_system: 'Diverse AI Content System Active',
        posting_mode: 'Multi-Style Intelligent Content',
        content_styles: '10 different viral patterns',
        topics_covered: '20+ health tech areas'
    });
});

app.get('/status', (req, res) => {
    res.json({
        bot_status: 'active',
        ai_orchestrator: 'running',
        content_diversity: 'maximum',
        last_decision: aiBot?.lastDecision || 'initializing',
        next_post_time: aiBot?.nextPostTime || 'ai_calculating',
        content_variety: aiBot?.contentVariety || 'high'
    });
});

class DiverseAIBotSystem {
    constructor() {
        this.isRunning = false;
        this.lastDecision = null;
        this.nextPostTime = null;
        this.contentVariety = 'maximum';
        
        // Import AI components dynamically
        this.initializeAI();
    }
    
    async initializeAI() {
        try {
            console.log('🎨 === INITIALIZING DIVERSE AI CONTENT SYSTEM ===');
            console.log('🔥 Ultra Viral Generator');
            console.log('🎭 Creative Content Agent');
            console.log('📊 Comprehensive Content Agent');
            console.log('⚡ Viral Content Agent');
            console.log('🧠 Supreme AI Orchestrator');
            
            // Dynamic imports for AI components
            const { UltraViralGenerator } = await import('./dist/agents/ultraViralGenerator.js');
            const { CreativeContentAgent } = await import('./dist/agents/creativeContentAgent.js');
            const { ComprehensiveContentAgent } = await import('./dist/agents/comprehensiveContentAgent.js');
            const { ViralContentAgent } = await import('./dist/agents/viralContentAgent.js');
            const { IntelligentSchedulingAgent } = await import('./dist/agents/intelligentSchedulingAgent.js');
            
            this.ultraViral = new UltraViralGenerator();
            this.creativeAgent = new CreativeContentAgent();
            this.comprehensiveAgent = new ComprehensiveContentAgent();
            this.viralAgent = new ViralContentAgent();
            this.schedulingAgent = new IntelligentSchedulingAgent();
            
            console.log('✅ Ultra Viral Generator loaded - 10 content styles');
            console.log('✅ Creative Content Agent loaded - original content');
            console.log('✅ Comprehensive Content Agent loaded - expert analysis');
            console.log('✅ Viral Content Agent loaded - maximum engagement');
            console.log('✅ Intelligent Scheduling Agent loaded - optimal timing');
            
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
                'AI drug discovery', 'precision medicine', 'digital therapeutics',
                'brain-computer interfaces', 'gene therapy', 'robotic surgery',
                'telemedicine', 'health monitoring', 'longevity research',
                'medical imaging AI', 'biomarker detection', 'personalized treatment',
                'rare disease research', 'cancer immunotherapy', 'mental health AI',
                'fitness tracking', 'medical devices', 'health data privacy',
                'wearable technology', 'AI diagnostics'
            ];
            
            this.lastTopics = new Set();
            
            return true;
        } catch (error) {
            console.log('❌ AI initialization failed:', error.message);
            console.log('🔄 Falling back to diverse fallback system...');
            this.setupDiverseFallback();
            return false;
        }
    }
    
    setupDiverseFallback() {
        this.diverseTemplates = [
            "🚨 BREAKTHROUGH: {tech} just achieved {result} in clinical trials. Revolutionary for {field}. #HealthTech",
            "📊 WILD DATA: {treatment} increased outcomes by {percentage}% in {demographic}. Cost: {price} vs {expensive_option}. #MedTech", 
            "💡 HOT TAKE: Traditional healthcare will be obsolete within 5 years. {supporting_data}. Ready? #HealthDebate",
            "🔍 INSIDER INTEL: What {industry} doesn't want you to know about {technology}. Lives at stake. #HealthcareSecrets",
            "⚡ OPTIMIZATION: {technique} improved {outcome} by {percentage}% vs standard methods. Available {price}. #Biohacking",
            "🚀 DISRUPTION: {company} made {service} affordable at {fraction} cost. {benefit}. Industry scrambling. #HealthDisruption",
            "🧬 GENE THERAPY: {advance} shows {result} for {condition}. {trial_data}. {timeline} availability. #GeneTherapy",
            "🤖 AI BREAKTHROUGH: Algorithm {capability} with {accuracy}% accuracy vs {comparison}. {timeline}. #MedicalAI"
        ];
        
        this.diverseTopics = [
            { topic: 'CRISPR editing', tech: 'prime editing', result: '99.7% accuracy', field: 'genetic diseases' },
            { topic: 'AI diagnostics', tech: 'deep learning', result: '94% vs 78% doctors', field: 'radiology' },
            { topic: 'VR therapy', tech: 'immersive treatment', result: '68% anxiety reduction', field: 'mental health' },
            { topic: 'liquid biopsy', tech: 'circulating DNA', result: '2-year early detection', field: 'cancer screening' },
            { topic: 'robotic surgery', tech: 'haptic feedback', result: '40% fewer complications', field: 'cardiac surgery' },
            { topic: 'neural implants', tech: 'brain-computer interface', result: '96% control accuracy', field: 'paralysis treatment' }
        ];
    }
    
    async start() {
        this.isRunning = true;
        console.log('🚀 === DIVERSE AI CONTENT SYSTEM STARTING ===');
        console.log('🎨 No more repetitive content!');
        console.log('📊 Maximum topic and style variety!');
        
        if (this.ultraViral) {
            console.log('🧠 AI generating diverse viral content...');
            this.diverseAILoop();
        } else {
            console.log('⚡ Starting diverse fallback mode...');
            this.diverseFallbackLoop();
        }
    }
    
    async diverseAILoop() {
        while (this.isRunning) {
            try {
                console.log('\n🎨 === AI GENERATING DIVERSE CONTENT ===');
                
                // Ensure topic diversity
                const availableTopics = this.healthTopics.filter(topic => !this.lastTopics.has(topic));
                if (availableTopics.length === 0) {
                    this.lastTopics.clear();
                    availableTopics.push(...this.healthTopics);
                }
                
                const selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
                const selectedStyle = this.contentStyles[Math.floor(Math.random() * this.contentStyles.length)];
                
                this.lastTopics.add(selectedTopic);
                if (this.lastTopics.size > 6) {
                    const firstTopic = this.lastTopics.values().next().value;
                    this.lastTopics.delete(firstTopic);
                }
                
                console.log('🔬 Topic:', selectedTopic);
                console.log('🎭 Style:', selectedStyle);
                
                // Generate diverse content
                const viralContent = await this.ultraViral.generateViralTweet(selectedTopic, selectedStyle);
                
                console.log('✅ Diverse content generated');
                console.log('📝 Preview:', viralContent.content.substring(0, 100) + '...');
                
                await this.postDiverseContent(viralContent.content, selectedTopic, selectedStyle);
                
                // AI-determined wait time (60-180 minutes for optimal engagement)
                const waitMinutes = this.calculateOptimalWaitTime();
                this.nextPostTime = new Date(Date.now() + waitMinutes * 60000).toISOString();
                
                console.log('🕐 Next diverse post in', waitMinutes, 'minutes');
                await this.sleep(waitMinutes * 60000);
                
            } catch (error) {
                console.log('❌ Diverse AI error:', error.message);
                console.log('🔄 Using creative fallback...');
                await this.generateAndPostFallback();
                await this.sleep(90 * 60000); // 90 minute fallback
            }
        }
    }
    
    async diverseFallbackLoop() {
        const { TwitterApi } = require('twitter-api-v2');
        
        const client = new TwitterApi({
            appKey: process.env.TWITTER_APP_KEY,
            appSecret: process.env.TWITTER_APP_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });
        
        while (this.isRunning) {
            try {
                const template = this.diverseTemplates[Math.floor(Math.random() * this.diverseTemplates.length)];
                const topicData = this.diverseTopics[Math.floor(Math.random() * this.diverseTopics.length)];
                
                let content = template
                    .replace('{tech}', topicData.tech)
                    .replace('{result}', topicData.result)
                    .replace('{field}', topicData.field)
                    .replace('{treatment}', 'new therapy')
                    .replace('{percentage}', Math.floor(Math.random() * 80) + 20)
                    .replace('{demographic}', ['adults 35+', 'patients', 'seniors'][Math.floor(Math.random() * 3)])
                    .replace('{price}', ['$99', '$199', '$299'][Math.floor(Math.random() * 3)])
                    .replace('{expensive_option}', ['$5,000 clinics', '$10,000 procedures'][Math.floor(Math.random() * 2)])
                    .replace('{industry}', ['Big Pharma', 'healthcare systems'][Math.floor(Math.random() * 2)])
                    .replace('{technology}', topicData.topic)
                    .replace('{company}', ['Stanford', 'MIT', 'Google Health'][Math.floor(Math.random() * 3)])
                    .replace('{accuracy}', Math.floor(Math.random() * 15) + 85);
                
                console.log('📤 Posting diverse fallback content');
                console.log('🔬 Topic:', topicData.topic);
                console.log('📝 Content:', content.substring(0, 100) + '...');
                
                const result = await client.v2.tweet(content);
                console.log('✅ Diverse fallback posted:', result.data.id);
                
                // Wait 2-3 hours with randomization
                const waitHours = 2 + Math.random();
                await this.sleep(waitHours * 60 * 60 * 1000);
                
            } catch (error) {
                console.log('❌ Diverse fallback failed:', error.message);
                await this.sleep(60 * 60000);
            }
        }
    }
    
    calculateOptimalWaitTime() {
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
    
    async postDiverseContent(content, topic, style) {
        try {
            const { TwitterApi } = require('twitter-api-v2');
            
            const client = new TwitterApi({
                appKey: process.env.TWITTER_APP_KEY,
                appSecret: process.env.TWITTER_APP_SECRET,
                accessToken: process.env.TWITTER_ACCESS_TOKEN,
                accessSecret: process.env.TWITTER_ACCESS_SECRET,
            });
            
            const result = await client.v2.tweet(content);
            
            console.log('🎉 DIVERSE CONTENT POSTED SUCCESSFULLY!');
            console.log('🔗 Tweet ID:', result.data.id);
            console.log('🔬 Topic:', topic);
            console.log('🎭 Style:', style);
            console.log('⏰ Posted at:', new Date().toISOString());
            
            this.lastDecision = { 
                action: 'posted',
                topic,
                style,
                time: new Date().toISOString(),
                diverse: true
            };
            
        } catch (error) {
            console.log('❌ Diverse posting failed:', error.message);
            throw error;
        }
    }
    
    async generateAndPostFallback() {
        try {
            const topicData = this.diverseTopics[Math.floor(Math.random() * this.diverseTopics.length)];
            const template = this.diverseTemplates[Math.floor(Math.random() * this.diverseTemplates.length)];
            
            let content = template
                .replace('{tech}', topicData.tech)
                .replace('{result}', topicData.result)
                .replace('{field}', topicData.field);
                
            await this.postDiverseContent(content, topicData.topic, 'CREATIVE_FALLBACK');
            
        } catch (error) {
            console.log('❌ Fallback generation failed:', error.message);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    stop() {
        this.isRunning = false;
        console.log('🛑 AI system stopped');
    }
}

// Global AI bot instance
let aiBot = null;

// Start the server and AI system
app.listen(PORT, async () => {
    console.log('🚀 Server running on port', PORT);
    console.log('🧠 Starting AI-driven posting system...');
    
    aiBot = new DiverseAIBotSystem();
    await aiBot.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, stopping AI system...');
    if (aiBot) aiBot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, stopping AI system...');
    if (aiBot) aiBot.stop();
    process.exit(0);
}); 
}); 