import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/server';
import { INVESTOR_COOKIE, sha256 } from '@/lib/investors';
import { MARKET_REPORT_HTML, MARKET_REPORT_PDF_B64 } from '@/lib/marketReport';

export const dynamic = 'force-dynamic';

/** The branded market report (web page, or ?download=1 for the PDF), only for signed-in investor-room visitors. */
export async function GET(req: Request) {
  const token = (await cookies()).get(INVESTOR_COOKIE)?.value;
  const room = token ? (await supabaseAnon().rpc('investor_room', { p_token_hash: sha256(token) })).data : null;
  if (!room) return NextResponse.redirect(new URL('/investors', req.url));
  const download = new URL(req.url).searchParams.has('download');
  if (!download) {
    return new NextResponse(MARKET_REPORT_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  const pdf = Buffer.from(MARKET_REPORT_PDF_B64, 'base64');
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ScoreDate-Market-Report.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
