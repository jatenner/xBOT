#!/usr/bin/env python3
import subprocess
import json
import base64
import sys
import os

os.chdir('/Users/jonahtenner/Desktop/xBOT')

SESSION_PATH = './twitter_session.json'
RAILWAY_SERVICE = 'serene-cat'

print('🚀 Pushing Session to Railway')
print('═══════════════════════════════════════════════════════════\n')

# Verify session file
if not os.path.exists(SESSION_PATH):
    print(f'❌ Session file not found: {SESSION_PATH}')
    sys.exit(1)

with open(SESSION_PATH, 'r') as f:
    session_data = f.read()

print(f'📁 Session file: {SESSION_PATH} ({len(session_data)} bytes)')

# Check for auth cookies
try:
    session = json.loads(session_data)
    cookies = session.get('cookies', [])
    auth_token = next((c for c in cookies if c.get('name') == 'auth_token'), None)
    ct0 = next((c for c in cookies if c.get('name') == 'ct0'), None)
    
    print(f'\n🍪 Cookie Check:')
    print(f'   auth_token: {"✅ YES" if auth_token else "❌ NO"}')
    print(f'   ct0: {"✅ YES" if ct0 else "❌ NO"}\n')
    
    if not auth_token or not ct0:
        print('❌ Missing required auth cookies!')
        sys.exit(1)
except json.JSONDecodeError:
    print('❌ Invalid JSON in session file')
    sys.exit(1)

# Base64 encode
session_b64 = base64.b64encode(session_data.encode()).decode()
print(f'📦 Encoded to base64: {len(session_b64)} chars\n')

# Push to Railway
print(f'🚀 Updating Railway service: {RAILWAY_SERVICE}')
try:
    cmd = ['railway', 'variables', '--service', RAILWAY_SERVICE, '--set', f'TWITTER_SESSION_B64={session_b64}']
    subprocess.run(cmd, check=True)
    print('✅ Railway variable updated\n')
except subprocess.CalledProcessError as e:
    print(f'❌ Failed to update Railway: {e}')
    sys.exit(1)

# Verify auth
print('🔍 Verifying auth on Railway...')
print('═══════════════════════════════════════════════════════════\n')
try:
    cmd = ['railway', 'run', '--service', RAILWAY_SERVICE, 'pnpm', 'exec', 'tsx', 'scripts/ops/run-harvester-single-cycle.ts']
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    
    output = result.stdout + result.stderr
    auth_lines = [line for line in output.split('\n') if '[HARVESTER_AUTH]' in line]
    
    if auth_lines:
        print('📋 [HARVESTER_AUTH] lines:')
        for line in auth_lines:
            print(f'   {line}')
        
        logged_in = any('logged_in=true' in line for line in auth_lines)
        if logged_in:
            print('\n✅ PASS: logged_in=true')
            sys.exit(0)
        else:
            print('\n❌ FAIL: logged_in=false')
            sys.exit(1)
    else:
        print('⚠️  No [HARVESTER_AUTH] lines found in output')
        print('\nFull output (last 50 lines):')
        lines = output.split('\n')
        for line in lines[-50:]:
            print(line)
        sys.exit(1)
except subprocess.TimeoutExpired:
    print('❌ Verification timed out')
    sys.exit(1)
except Exception as e:
    print(f'❌ Verification failed: {e}')
    sys.exit(1)
