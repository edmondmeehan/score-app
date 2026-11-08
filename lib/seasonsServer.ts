import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAnon } from '@/lib/supabase/server';
import { mergeSeasonConfig, type SeasonConfig, SEASON_CONFIG_DEFAULT } from '@/lib/seasons';

/** Cached for 10 minutes; saving in Admin → Seasonal themes refreshes it right away. */
export const getSeasonConfig = unstable_cache(async (): Promise<SeasonConfig> => {
  try {
    const { data } = await supabaseAnon().from('app_config').select('value').eq('key', 'seasonal_themes').maybeSingle();
    return mergeSeasonConfig(data?.value);
  } catch {
    return SEASON_CONFIG_DEFAULT;
  }
}, ['seasonal-themes'], { tags: ['seasons'], revalidate: 600 });
