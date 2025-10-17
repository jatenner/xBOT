#!/usr/bin/env node

/**
 * 🚂 RAILWAY LOGS VIEWER - NO CLI DEPENDENCY
 * 
 * This script fetches Railway logs directly via GraphQL API
 * No more "Unauthorized" bullshit from CLI
 * 
 * Usage:
 *   node railway-logs.js          # Live logs (last 100 lines)
 *   node railway-logs.js --all    # All recent logs
 *   node railway-logs.js --follow # Follow mode (like tail -f)
 */

const https = require('https');

// Railway API endpoint
const RAILWAY_API = 'backboard.railway.app';

// Get token from environment or .railway file
function getToken() {
  // First try environment variable
  if (process.env.RAILWAY_TOKEN) {
    return process.env.RAILWAY_TOKEN;
  }
  
  // Try to read from .railway directory
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  try {
    const configPath = path.join(os.homedir(), '.railway', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.token;
    }
  } catch (error) {
    console.error('⚠️ Could not read Railway token from config:', error.message);
  }
  
  console.error('❌ ERROR: No Railway token found!');
  console.error('');
  console.error('Set RAILWAY_TOKEN environment variable:');
  console.error('  export RAILWAY_TOKEN="your_token_here"');
  console.error('');
  console.error('Or login with Railway CLI:');
  console.error('  railway login');
  process.exit(1);
}

// Get project ID from environment
function getProjectId() {
  if (process.env.RAILWAY_PROJECT_ID) {
    return process.env.RAILWAY_PROJECT_ID;
  }
  
  // Try to read from .railway directory
  const fs = require('fs');
  const path = require('path');
  
  try {
    const projectPath = path.join(process.cwd(), '.railway', 'project.json');
    if (fs.existsSync(projectPath)) {
      const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
      return project.id;
    }
  } catch (error) {
    console.error('⚠️ Could not read project ID:', error.message);
  }
  
  console.error('❌ ERROR: No Railway project ID found!');
  console.error('');
  console.error('Set RAILWAY_PROJECT_ID environment variable:');
  console.error('  export RAILWAY_PROJECT_ID="your_project_id"');
  console.error('');
  console.error('Or run: railway link');
  process.exit(1);
}

// Fetch logs via GraphQL
async function fetchLogs(token, projectId, limit = 100) {
  const query = `
    query DeploymentLogs($projectId: String!, $limit: Int!) {
      project(id: $projectId) {
        deployments(limit: 1) {
          edges {
            node {
              id
              status
              createdAt
              staticUrl
              logs(limit: $limit) {
                edges {
                  node {
                    timestamp
                    message
                    severity
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const variables = {
    projectId,
    limit
  };
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    
    const options = {
      hostname: RAILWAY_API,
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          if (response.errors) {
            reject(new Error(response.errors[0].message));
            return;
          }
          
          resolve(response.data);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

// Format and display logs
function displayLogs(data) {
  const deployment = data?.project?.deployments?.edges?.[0]?.node;
  
  if (!deployment) {
    console.log('❌ No deployments found');
    return;
  }
  
  console.log('🚂 Railway Logs');
  console.log('─────────────────────────────────────────────────');
  console.log(`Deployment: ${deployment.id}`);
  console.log(`Status: ${deployment.status}`);
  console.log(`Created: ${new Date(deployment.createdAt).toLocaleString()}`);
  if (deployment.staticUrl) {
    console.log(`URL: ${deployment.staticUrl}`);
  }
  console.log('─────────────────────────────────────────────────');
  console.log('');
  
  const logs = deployment.logs?.edges || [];
  
  if (logs.length === 0) {
    console.log('📭 No logs yet');
    return;
  }
  
  logs.forEach(({ node }) => {
    const timestamp = new Date(node.timestamp).toLocaleTimeString();
    const severity = node.severity || 'INFO';
    const icon = severity === 'ERROR' ? '❌' : severity === 'WARN' ? '⚠️' : '📝';
    
    console.log(`${icon} [${timestamp}] ${node.message}`);
  });
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const follow = args.includes('--follow') || args.includes('-f');
  const all = args.includes('--all');
  
  console.log('🚂 Railway Logs Viewer');
  console.log('');
  
  const token = getToken();
  const projectId = getProjectId();
  
  const limit = all ? 500 : 100;
  
  try {
    const data = await fetchLogs(token, projectId, limit);
    displayLogs(data);
    
    if (follow) {
      console.log('');
      console.log('👀 Following logs (Ctrl+C to stop)...');
      console.log('');
      
      // Poll every 5 seconds
      setInterval(async () => {
        try {
          const newData = await fetchLogs(token, projectId, 50);
          const logs = newData?.project?.deployments?.edges?.[0]?.node?.logs?.edges || [];
          
          logs.forEach(({ node }) => {
            const timestamp = new Date(node.timestamp).toLocaleTimeString();
            const severity = node.severity || 'INFO';
            const icon = severity === 'ERROR' ? '❌' : severity === 'WARN' ? '⚠️' : '📝';
            
            console.log(`${icon} [${timestamp}] ${node.message}`);
          });
        } catch (error) {
          console.error('⚠️ Error fetching logs:', error.message);
        }
      }, 5000);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Unauthorized')) {
      console.error('');
      console.error('💡 Your Railway token may be expired or invalid.');
      console.error('Run: railway login');
    }
    
    process.exit(1);
  }
}

// Run
main();
