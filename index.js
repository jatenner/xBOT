const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'Snap2Health AI Bot - Supreme Intelligence Active',
        timestamp: new Date().toISOString(),
        features: [
            'AI-Driven Posting Decisions',
            'Intelligent Scheduling Agent', 
            'Dynamic Content Optimization',
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
        ai_system: 'Supreme AI Orchestrator Active',
        posting_mode: 'AI-Determined Optimal Times'
    });
});

app.get('/status', (req, res) => {
    res.json({
        bot_status: 'active',
        ai_orchestrator: 'running',
        scheduling_agent: 'active',
        last_decision: aiBot?.lastDecision || 'initializing',
        next_post_time: aiBot?.nextPostTime || 'ai_calculating'
    });
});

class AIBotSystem {
    constructor() {
        this.isRunning = false;
        this.lastDecision = null;
        this.nextPostTime = null;
        
        // Import AI components dynamically
        this.initializeAI();
    }
    
    async initializeAI() {
        try {
            console.log('🧠 === INITIALIZING SUPREME AI SYSTEM ===');
            console.log('👑 AI will make ALL posting decisions');
            console.log('⚡ No hardcoded schedules - pure intelligence');
            
            // Dynamic imports for AI components
            const { SupremeAIOrchestrator } = await import('./dist/agents/supremeAIOrchestrator.js');
            const { IntelligentSchedulingAgent } = await import('./dist/agents/intelligentSchedulingAgent.js');
            const { DynamicPostingController } = await import('./dist/utils/dynamicPostingController.js');
            
            this.supremeAI = new SupremeAIOrchestrator();
            this.schedulingAgent = new IntelligentSchedulingAgent();
            this.dynamicController = new DynamicPostingController();
            
            console.log('✅ Supreme AI Orchestrator initialized');
            console.log('🕐 Intelligent Scheduling Agent active');
            console.log('📊 Dynamic Posting Controller ready');
            
            return true;
        } catch (error) {
            console.log('❌ AI initialization failed:', error.message);
            console.log('🔄 Falling back to simple posting mode...');
            return false;
        }
    }
    
    async start() {
        this.isRunning = true;
        console.log('🚀 === AI SYSTEM STARTING ===');
        
        if (this.supremeAI) {
            console.log('🧠 AI is analyzing optimal posting strategies...');
            this.aiDecisionLoop();
        } else {
            console.log('⚡ Starting fallback posting mode...');
            this.fallbackPostingLoop();
        }
        
        // Start learning loop
        this.startLearningLoop();
    }
    
    async aiDecisionLoop() {
        while (this.isRunning) {
            try {
                console.log('\n🤖 === AI MAKING POSTING DECISION ===');
                
                // AI decides when and what to post
                const decision = await this.supremeAI.makePostingDecision();
                this.lastDecision = decision;
                
                if (decision.shouldPost) {
                    console.log('✅ AI Decision: POST NOW');
                    console.log('📝 Content Strategy:', decision.contentStrategy);
                    console.log('⏰ Timing Reason:', decision.timingReason);
                    
                    await this.executeAIPosting(decision);
                } else {
                    console.log('⏳ AI Decision: WAIT');
                    console.log('🔍 Reason:', decision.reason);
                    console.log('⏰ Next check:', decision.nextCheckIn, 'minutes');
                }
                
                // AI determines next decision time
                const nextDecision = decision.nextCheckIn || await this.schedulingAgent.getNextDecisionTime();
                this.nextPostTime = new Date(Date.now() + nextDecision * 60000).toISOString();
                
                console.log('🕐 Next AI decision in', nextDecision, 'minutes');
                
                // Wait for AI-determined time
                await this.sleep(nextDecision * 60000);
                
            } catch (error) {
                console.log('❌ AI decision error:', error.message);
                await this.sleep(30 * 60000); // 30 minute fallback
            }
        }
    }
    
    async fallbackPostingLoop() {
        const { TwitterApi } = require('twitter-api-v2');
        
        const client = new TwitterApi({
            appKey: process.env.TWITTER_APP_KEY,
            appSecret: process.env.TWITTER_APP_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });
        
        const tweets = [
            "🧬 CRISPR-Cas9 technology achieved 99.1% precision in gene editing trials. Genetic medicine is accelerating beyond expectations. #GeneTherapy #HealthTech",
            "📊 Digital therapeutics market projected to reach $32.4B by 2030. Healthcare is transforming from pills to pixels. #DigitalHealth",
            "🔬 AI-powered drug discovery cut development time from 10 to 3 years for Alzheimer's treatment. Technology rewriting pharma timelines. #AI #DrugDiscovery"
        ];
        
        let currentIndex = 0;
        
        while (this.isRunning) {
            try {
                const tweet = tweets[currentIndex];
                const result = await client.v2.tweet(tweet);
                
                console.log('✅ Fallback tweet posted:', result.data.id);
                console.log('📝 Content:', tweet.substring(0, 100) + '...');
                
                currentIndex = (currentIndex + 1) % tweets.length;
                
                // Wait 2 hours between posts
                await this.sleep(2 * 60 * 60 * 1000);
                
            } catch (error) {
                console.log('❌ Fallback posting failed:', error.message);
                await this.sleep(30 * 60000);
            }
        }
    }
    
    async executeAIPosting(decision) {
        try {
            const result = await this.dynamicController.processOpportunity({
                type: decision.contentType,
                priority: decision.priority,
                strategy: decision.contentStrategy,
                timing: decision.timingReason
            });
            
            if (result.success) {
                console.log('🎉 AI Posted Successfully:', result.tweetId);
                console.log('📊 Content:', result.content?.substring(0, 100) + '...');
            } else {
                console.log('⚠️ AI Posting failed:', result.error);
            }
            
        } catch (error) {
            console.log('❌ AI posting execution failed:', error.message);
        }
    }
    
    async startLearningLoop() {
        setInterval(async () => {
            try {
                if (this.supremeAI) {
                    await this.supremeAI.optimizeStrategy();
                    console.log('🧠 AI learning cycle completed');
                }
            } catch (error) {
                console.log('⚠️ Learning cycle error:', error.message);
            }
        }, 60 * 60 * 1000); // Learn every hour
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
    
    aiBot = new AIBotSystem();
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