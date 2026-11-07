import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { searchTracks, spotifyConfigured } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 });
  if (!(await spotifyConfigured())) return NextResponse.json({ error: 'not configured' }, { status: 501 });
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ tracks: [] });
  try {
    return NextResponse.json({ tracks: await searchTracks(q) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'search failed' }, { status: 502 });
  }
}
