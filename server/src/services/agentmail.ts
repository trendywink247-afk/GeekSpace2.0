// ============================================================
// AgentMail Email Integration
//
// Alternative email delivery via AgentMail API.
// Used as a fallback when Resend is not configured, or
// as a replacement for transactional emails.
// Gracefully no-ops if AGENTMAIL_API_KEY is not set.
// ============================================================

export interface AgentMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendAgentMail(
  to: string,
  subject: string,
  body: string
): Promise<AgentMailResult> {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) return { success: false, error: 'No API key' };

  try {
    const res = await fetch('https://api.agentmail.to/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, subject, text: body }),
    });

    const data = await res.json() as { id?: string; error?: string };
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true, messageId: data.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
