/**
 * 🚨 DISCORD WEBHOOK ALERTS
 * Sends alerts on state transitions to avoid spam
 */

interface AlertState {
  lastState: 'healthy' | 'degraded';
  lastAlertAt: number | null;
}

const alertState: AlertState = {
  lastState: 'healthy',
  lastAlertAt: null,
};

export async function sendDiscordAlert(message: string, isError: boolean = false): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    // Discord alerts not configured, skip
    return;
  }
  
  try {
    const color = isError ? 15548997 : 5763719; // Red for errors, green for recovery
    
    const payload = {
      embeds: [{
        title: isError ? '🚨 xBOT Alert - System Degraded' : '✅ xBOT Alert - System Recovered',
        description: message,
        color,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'xBOT Autonomous Growth Machine',
        },
      }],
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error('[DISCORD_ALERT] Failed to send:', response.status, response.statusText);
    } else {
      console.log(`[DISCORD_ALERT] Sent: ${isError ? 'degraded' : 'recovered'}`);
    }
  } catch (error: any) {
    console.error('[DISCORD_ALERT] Error:', error.message);
  }
}

export async function checkAndAlertOnStateChange(
  isDegraded: boolean,
  degradedReason: string
): Promise<void> {
  const currentState = isDegraded ? 'degraded' : 'healthy';
  
  // Only alert on state transitions
  if (currentState !== alertState.lastState) {
    const now = Date.now();
    
    // Rate limit: don't send more than 1 alert per 5 minutes
    if (alertState.lastAlertAt && (now - alertState.lastAlertAt) < 5 * 60 * 1000) {
      return;
    }
    
    if (isDegraded) {
      await sendDiscordAlert(
        `**System degraded:**\n${degradedReason}`,
        true
      );
    } else {
      await sendDiscordAlert(
        '**System recovered:** All jobs are healthy and running normally.',
        false
      );
    }
    
    alertState.lastState = currentState;
    alertState.lastAlertAt = now;
  }
}

