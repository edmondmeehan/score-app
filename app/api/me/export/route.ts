import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** "Download my data": a JSON copy of everything Score keeps about the signed-in member. */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/signin', process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app'));
  const { data, error } = await supabase.rpc('my_data_export');
  if (error) return NextResponse.json({ error: 'Could not build your export. Please try again or contact support.' }, { status: 500 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="score-my-data-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
