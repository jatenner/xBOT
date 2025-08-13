import * as fs from 'fs';
import * as path from 'path';

export class TwitterSessionManager {
  private static sessionPath = path.join(process.cwd(), 'data', 'twitter_session.json');

  public static hasValidSession(): boolean {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        console.log('❌ No Twitter session file found');
        return false;
      }

      const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      
      // Check if session has required cookies
      if (!sessionData.cookies || !Array.isArray(sessionData.cookies) || sessionData.cookies.length === 0) {
        console.log('❌ Twitter session file exists but contains no cookies');
        return false;
      }

      // Check for essential Twitter cookies
      const essentialCookies = ['auth_token', 'ct0'];
      const cookieNames = sessionData.cookies.map((c: any) => c.name);
      const hasEssentialCookies = essentialCookies.some(name => cookieNames.includes(name));

      if (!hasEssentialCookies) {
        console.log('❌ Twitter session missing essential cookies (auth_token, ct0)');
        return false;
      }

      console.log('✅ Valid Twitter session found');
      return true;
    } catch (error) {
      console.log('❌ Error checking Twitter session:', error.message);
      return false;
    }
  }

  public static getSessionInfo(): { hasSession: boolean; cookieCount: number; message: string } {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return {
          hasSession: false,
          cookieCount: 0,
          message: 'No session file found. Please run: npm run init-session'
        };
      }

      const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      const cookieCount = sessionData.cookies ? sessionData.cookies.length : 0;

      return {
        hasSession: cookieCount > 0,
        cookieCount,
        message: cookieCount > 0 
          ? `Valid session with ${cookieCount} cookies`
          : 'Session file exists but has no cookies'
      };
    } catch (error) {
      return {
        hasSession: false,
        cookieCount: 0,
        message: `Error reading session: ${error.message}`
      };
    }
  }
}