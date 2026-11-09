import { revalidatePath } from 'next/cache';
import NewWindowLink from '@/components/NewWindowLink';
import { supabaseServer } from '@/lib/supabase/server';
import { gday, usd, type Giveaway } from '@/lib/giveaways';

async function enter(form: FormData) {
  'use server';
  const supabase = await supabaseServer();
  await supabase.rpc('enter_giveaway', { p_g: String(form.get('id')) });
  revalidatePath('/app/discover');
  revalidatePath('/app/giveaways');
}

/** Free giveaway card in Discover. One tap to enter; entering never needs a purchase (Apple 5.3). */
export default function GiveawayCard({ g, mine }: { g: Giveaway; mine: { entered: boolean; entries: number } | null }) {
  return (
    <div className="card gold stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        {g.image_url && <img src={g.image_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, flex: 'none' }} />}
        <div className="stack grow" style={{ gap: 2 }}>
          <span className="label">Giveaway{g.partner ? ` · ${g.partner}` : ''}</span>
          <span className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>{g.title}</span>
          <span className="small muted">{g.prize} · {usd(Number(g.prize_value_usd))} value · ends {gday(g.ends_at)}</span>
        </div>
      </div>
      {mine?.entered ? (
        <div className="small" style={{ color: 'var(--gold-light)' }}>You’re in with {mine.entries} entr{mine.entries === 1 ? 'y' : 'ies'}. Finish your profile or invite a friend for bonus entries.</div>
      ) : (
        <form action={enter}><input type="hidden" name="id" value={g.id} /><button className="btn block">Enter free</button></form>
      )}
      <span className="small muted" style={{ fontSize: 12 }}>No purchase necessary. Sponsored by ScoreDate, LLC; Apple is not a sponsor or involved. <NewWindowLink href={`/giveaways/${g.id}/rules`}>Official rules</NewWindowLink></span>
    </div>
  );
}
