import { endTraveling, endVisit, setTraveling, setVisit } from '@/app/app/actions';
import { awayLabel, dayLabel, isAway, isVisiting, isoPlus, isoToday } from '@/lib/away';
import type { Profile } from '@/lib/types';

/** Settings card: Traveling for everyone, plus Visiting for Nomads. */
export default function TravelCard({ me }: { me: Profile }) {
  const away = isAway(me);
  const visiting = isVisiting(me);
  return (
    <div className="card stack" id="travel" style={{ gap: 12 }}>
      <span className="label">Traveling</span>
      {away ? (
        <form action={endTraveling} className="stack" style={{ gap: 10 }}>
          <strong>{awayLabel(me, true)}</strong>
          <span className="small muted">{me.away_pause ? 'Your Drops are paused until you’re back, and you’re not shown in others’ Drops.' : 'Your Drops keep coming, so you can line up dates for when you’re back.'} Your matches see “{awayLabel(me)}” on your profile.</span>
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>I’m back</button>
        </form>
      ) : (
        <form action={setTraveling} className="stack" style={{ gap: 10 }}>
          <span className="small muted">Away for a while but not moving? Keep your home zip, and your profile shows when you’ll be back. Up to 90 days.</span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="field grow">Back on<input className="input" type="date" name="until" required min={isoPlus(1)} max={isoPlus(90)} /></label>
            <label className="field grow">Where (optional, only you see it)<input className="input" name="where" maxLength={60} placeholder="e.g. London" /></label>
          </div>
          <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="pause" style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>Pause my Drops while I’m away</strong><span className="small muted">Leave it off to keep getting Drops and plan dates for when you’re back.</span></span></label>
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>Turn on Traveling</button>
        </form>
      )}
      {me.nomad && (
        <div className="stack" style={{ gap: 10, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
          <span className="label">Visiting NYC</span>
          {visiting ? (
            <form action={endVisit} className="stack" style={{ gap: 8 }}>
              <strong>Visiting until {dayLabel(me.visit_until)}</strong>
              <span className="small muted">You’re getting Drops in New York while you’re here.</span>
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>End visit</button>
            </form>
          ) : (
            <form action={setVisit} className="stack" style={{ gap: 8 }}>
              <span className="small muted">Back in the city for a few days? Get Drops and meet people while you’re here. Up to 14 days.</span>
              <label className="field">Last day of your visit<input className="input" type="date" name="until" required min={isoToday()} max={isoPlus(14)} /></label>
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>I’m visiting</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
