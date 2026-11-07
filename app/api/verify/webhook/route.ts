import { NextResponse } from 'next/server';
import { mapStatus, verifyWebhook } from '@/lib/persona';
import { supabaseAnon } from '@/lib/supabase/server';
import { contactFor, sendEmail } from '@/lib/mailer';

// Persona sends inquiry events here. Configure the webhook URL in the Persona dashboard:
//   https://<your domain>/api/verify/webhook  (events: inquiry.approved, inquiry.declined, inquiry.marked-for-review, inquiry.completed, inquiry.failed)
export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyWebhook(raw, req.headers.get('persona-signature')))) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  const event = JSON.parse(raw);
  const inquiry = event?.data?.attributes?.payload?.data;
  const userId: string | undefined = inquiry?.attributes?.['reference-id'] ?? inquiry?.attributes?.referenceId;
  const status = mapStatus(inquiry?.attributes?.status ?? '');
  if (!userId || status === 'pending') return NextResponse.json({ ok: true, skipped: true });
  const { error } = await supabaseAnon().rpc('record_id_result', {
    p_secret: process.env.SCORE_SERVER_SECRET, p_user: userId, p_provider: 'persona', p_ref: inquiry.id, p_status: status, p_detail: event?.data?.attributes?.name ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (status === 'approved' || status === 'declined') {
    const c = await contactFor(userId);
    await sendEmail(c.email, status === 'approved' ? 'id_approved' : 'id_needs_attention', { first_name: c.first_name });
  }
  return NextResponse.json({ ok: true });
}
