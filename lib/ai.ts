import 'server-only';

/**
 * Short text generation for small features (conversation ideas). Uses Anthropic directly when ANTHROPIC_API_KEY is set,
 * otherwise Vercel AI Gateway when AI_GATEWAY_API_KEY is set. Returns null when neither is set or the call fails,
 * so callers always have a non-AI fallback.
 */
export const aiReady = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY);
export const AI_PROVIDER_NAME = 'Anthropic';

export async function generate(system: string, user: string, maxTokens = 400): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-4-5', max_tokens: maxTokens, temperature: 1, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!r.ok) return null;
      const j = await r.json();
      return (j.content || []).map((c: { text?: string }) => c.text || '').join('').trim() || null;
    }
    if (process.env.AI_GATEWAY_API_KEY) {
      const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}` },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'anthropic/claude-haiku-4.5', max_tokens: maxTokens, temperature: 1, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j.choices?.[0]?.message?.content?.trim() || null;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
