import 'server-only';
import { connect, type ClientHttp2Session } from 'node:http2';
import { createSign } from 'node:crypto';

/**
 * Native push straight to Apple (APNs) for the ScoreDate iPhone app. Capacitor hands the app a raw APNs
 * device token, so iPhone pushes go here rather than through Firebase.
 * Env: APNS_KEY (the .p8 file contents), APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID (default co.please.scoredate).
 * TestFlight and App Store builds use Apple's production server; builds run from Xcode use the sandbox,
 * so a token the production server rejects is retried once on the sandbox.
 */
const HOSTS = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' } as const;
let jwt: { token: string; at: number } | null = null;

const key = () => (process.env.APNS_KEY || '').replace(/\\n/g, '\n').trim();
export const apnsReady = () => Boolean(key() && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

function authToken(): string {
  // Apple wants a fresh token at most every 20–60 minutes.
  if (jwt && Date.now() - jwt.at < 40 * 60 * 1000) return jwt.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'ES256', kid: process.env.APNS_KEY_ID })}.${b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
  const sig = createSign('SHA256').update(unsigned).sign({ key: key(), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  jwt = { token: `${unsigned}.${sig}`, at: Date.now() };
  return jwt.token;
}

function post(session: ClientHttp2Session, token: string, body: string, priority: string, collapse?: string) {
  return new Promise<{ status: number; reason?: string }>((resolve) => {
    const req = session.request({
      ':method': 'POST', ':path': `/3/device/${token}`,
      authorization: `bearer ${authToken()}`,
      'apns-topic': process.env.APNS_BUNDLE_ID || 'co.please.scoredate',
      'apns-push-type': 'alert', 'apns-priority': priority,
      ...(collapse ? { 'apns-collapse-id': collapse.slice(0, 64) } : {}),
      'content-type': 'application/json',
    });
    let status = 0; let data = '';
    req.on('response', (h) => { status = Number(h[':status']) || 0; });
    req.on('data', (c) => { data += c; });
    req.on('end', () => { let reason: string | undefined; try { reason = JSON.parse(data || '{}').reason; } catch { /* empty */ } resolve({ status, reason }); });
    req.on('error', () => resolve({ status: 0, reason: 'network' }));
    req.setTimeout(10_000, () => { req.close(); resolve({ status: 0, reason: 'timeout' }); });
    req.end(body);
  });
}

async function sendTo(host: keyof typeof HOSTS, token: string, body: string, priority: string, collapse?: string) {
  const session = connect(HOSTS[host]);
  try { return await post(session, token, body, priority, collapse); } finally { session.close(); }
}

/** Returns 'ok', 'dead' (token no longer valid) or 'error'. */
export async function sendApns(token: string, n: { title: string; body: string; url: string; tag?: string; high?: boolean }): Promise<'ok' | 'dead' | 'error'> {
  if (!apnsReady()) return 'error';
  const body = JSON.stringify({ aps: { alert: { title: n.title, body: n.body }, sound: 'default', 'thread-id': n.tag }, url: n.url });
  const priority = n.high ? '10' : '5';
  try {
    let r = await sendTo('production', token, body, priority, n.tag);
    if (r.status === 400 && r.reason === 'BadDeviceToken') r = await sendTo('sandbox', token, body, priority, n.tag);
    if (r.status === 200) return 'ok';
    if (r.status === 410 || r.reason === 'Unregistered' || r.reason === 'BadDeviceToken') return 'dead';
    console.error('[apns]', r.status, r.reason);
    return 'error';
  } catch (e) {
    console.error('[apns]', (e as Error).message);
    return 'error';
  }
}
