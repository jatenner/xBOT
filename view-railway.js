#!/usr/bin/env node

/**
 * 🚂 SIMPLE RAILWAY VIEWER
 * Bypasses CLI, uses API directly
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get token from config
function getToken() {
  try {
    const configPath = path.join(os.homedir(), '.railway', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.user.token;
  } catch (error) {
    console.error('❌ Could not read Railway token');
    process.exit(1);
  }
}

// Get project info
const PROJECT_ID = 'c987ff2e-2bc7-4c65-9187-11c1a82d4ac1';
const SERVICE_ID = '21eb1b60-57f1-40fe-bd0e-d589345fc37f';

// Fetch deployment logs
async function fetchLogs(token, limit = 200) {
  const query = `
    query ServiceLogs($environmentId: String!, $serviceId: String!, $limit: Int!) {
      logs(
        environmentId: $environmentId
        serviceId: $serviceId
        limit: $limit
      ) {
        timestamp
        message
      }
    }
  `;
  
  const variables = {
    environmentId: '253a53f1-f80e-401a-8a7f-afdcf2648fad',
    serviceId: SERVICE_ID,
    limit
  };
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    
    const options = {
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(response.errors[0].message));
          } else {
            resolve(response.data);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Main
async function main() {
  console.log('🚂 Railway xBOT Logs\n');
  
  const token = getToken();
  
  try {
    const data = await fetchLogs(token, 200);
    
    if (!data.logs || data.logs.length === 0) {
      console.log('📭 No logs available');
      return;
    }
    
    console.log(`📊 Showing last ${data.logs.length} logs:\n`);
    
    data.logs.forEach(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      console.log(`[${time}] ${log.message}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

