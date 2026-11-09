'use server';
import { supabaseServer } from '@/lib/supabase/server';
import type { Live } from './LiveNow';

export async function liveNow(): Promise<Live> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('staff_live_now');
  return (data as Live) || null;
}
