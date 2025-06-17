# 🎯 Snap2Health X-Bot Master Control Dashboard

## Overview

The Master Control Dashboard is a comprehensive real-time monitoring and control system for your Snap2Health X-Bot. It provides god-like visibility into your bot's intelligence, performance, and decision-making processes, complete with an AI assistant powered by OpenAI.

## Features

### 🤖 AI System Intelligence
- **Real-time AI Chat**: Ask questions about bot performance, strategy, and system insights
- **OpenAI Integration**: GPT-4 powered assistant with complete access to bot data
- **Contextual Responses**: AI understands current system state and provides data-driven insights

### 📊 Real-time Monitoring
- **Live System Status**: Bot status, daily posts, quality scores, last actions
- **Agent Health**: Monitor all 7 agents (Strategist, Content, Engagement, Learning, Optimizer)
- **API Quota Tracking**: Real-time usage monitoring with visual progress bars
- **Performance Metrics**: Engagement rates, follower growth, reach scores

### ⚡ System Controls
- **Emergency Kill Switch**: Instantly stop all bot operations
- **Force Post Generation**: Manually trigger content creation
- **Manual Optimization**: Run nightly optimization on demand
- **Quota Reset**: Reset daily API usage counters

### 📈 Intelligence Dashboard
- **Decision Analysis**: Current strategy, next actions, confidence levels
- **Content Pipeline**: Queue status, success rates, last generated content
- **Live Activity Log**: Real-time system events and actions
- **Performance Trends**: Visual tracking of bot performance over time

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build
```

### 3. Start the Dashboard
```bash
npm run dashboard
```

### 4. Access the Dashboard
Open your browser to: `http://localhost:3001`

## Architecture

### Backend (`dashboardServer.ts`)
- **Express.js Server**: RESTful API endpoints
- **Socket.IO**: Real-time WebSocket communication
- **OpenAI Integration**: AI assistant with system context
- **Supabase Integration**: Real-time data from bot database

### Frontend (`masterControl.html`)
- **Modern UI**: Glassmorphism design with smooth animations
- **Real-time Updates**: WebSocket-powered live data
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Interactive Controls**: One-click system management

## API Endpoints

### System Status
- `GET /api/system-status` - Current bot status and metrics
- `GET /api/metrics` - Performance metrics and trends
- `GET /api/agents` - Agent health status

### Controls
- `POST /api/emergency-stop` - Activate kill switch
- `POST /api/force-post` - Generate post immediately
- `POST /api/optimize-now` - Run manual optimization
- `POST /api/reset-quota` - Reset daily quotas

### AI Assistant
- `POST /api/ai-chat` - Send message to AI assistant

## WebSocket Events

### Client → Server
- `ai_query` - Send message to AI assistant

### Server → Client
- `system_status` - Initial system status
- `metrics_update` - Real-time metrics update
- `activity_log` - New activity log entry
- `system_update` - System state changes
- `ai_response` - AI assistant response

## AI Assistant Capabilities

The AI assistant has complete access to:
- Current bot status and configuration
- Recent tweet performance and engagement
- API usage and quota status
- Agent health and activity
- Historical performance data

### Example Queries
- "How is the bot performing today?"
- "Why did the last post get low engagement?"
- "What's the current API usage status?"
- "Explain the strategist's decision-making"
- "How can we improve content quality?"

## Configuration

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### Port Configuration
- Dashboard runs on port `3001` by default
- Main bot health check runs on port `3000`
- Configurable in `dashboardLauncher.ts`

## Integration with Main Bot

The dashboard integrates seamlessly with your existing bot:

1. **Shared Database**: Uses same Supabase instance
2. **Real-time Data**: Live updates from bot operations
3. **Control Integration**: Direct control over bot functions
4. **Independent Operation**: Runs separately from main bot

## Security Features

- **Local Network Only**: Dashboard runs on localhost by default
- **No External Access**: All data stays within your system
- **Secure API**: Protected endpoints with error handling
- **Safe Controls**: Confirmation dialogs for destructive actions

## Troubleshooting

### Dashboard Won't Start
1. Check if port 3001 is available
2. Ensure all dependencies are installed
3. Verify environment variables are set

### AI Assistant Not Responding
1. Check OpenAI API key configuration
2. Verify internet connection
3. Check API quota limits

### Real-time Updates Not Working
1. Check WebSocket connection status
2. Verify bot is running and accessible
3. Check Supabase connection

## Advanced Usage

### Custom Metrics
Add custom metrics by modifying `collectMetrics()` in `dashboardServer.ts`

### Additional Controls
Add new control buttons by:
1. Adding endpoint in `setupRoutes()`
2. Adding button in HTML
3. Implementing control function

### AI Assistant Customization
Modify the system context in `processAIQuery()` to customize AI responses

## Performance

- **Real-time Updates**: 10-second intervals for metrics
- **Activity Logs**: 15-second intervals for system activities
- **WebSocket Efficiency**: Minimal bandwidth usage
- **Responsive UI**: Smooth animations and interactions

## Support

For issues or questions:
1. Check the activity log for error messages
2. Verify all dependencies are installed
3. Ensure proper environment configuration
4. Check network connectivity

---

**The Master Control Dashboard gives you complete visibility and control over your autonomous Twitter bot, with AI-powered insights to help you understand and optimize its performance.** 