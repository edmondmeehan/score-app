'use client';
import { useState } from 'react';

/** Copy / native-share for a waitlist referral link. */
export default function ShareInvite({ url, compact = false }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = 'I just joined the waitlist for Score, the invite-only dating app where everyone’s credit and ID are verified. Join with my link:';
  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Score', text, url }); return; } catch { /* cancelled */ }
    }
    copy();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }
  const enc = encodeURIComponent;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <input className="input mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0, fontSize: 14 }} aria-label="Your invite link" />
        <button type="button" className="btn ghost sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" onClick={share}>Share my link</button>
        {!compact && <>
          <a className="btn ghost sm" href={`sms:?&body=${enc(text + ' ' + url)}`}>Text</a>
          <a className="btn ghost sm" href={`mailto:?subject=${enc('Join me on Score')}&body=${enc(text + '\n\n' + url)}`}>Email</a>
          <a className="btn ghost sm" href={`https://wa.me/?text=${enc(text + ' ' + url)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </>}
      </div>
    </div>
  );
}
