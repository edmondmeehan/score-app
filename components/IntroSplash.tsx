/**
 * Opening animation for the ScoreDate iPhone/Android app: a credit-band gauge whose four colored
 * segments draw in while the needle sweeps from Building to Elite, then the wordmark, then it fades away.
 * Plain HTML + CSS so it shows on the very first paint. Plays once per app launch (and on any page with ?intro=1
 * for previewing). Skipped on the website, and shortened for people who turn on Reduce Motion.
 */
export const INTRO_SCRIPT = `(function(){try{var q=location.search.indexOf('intro=1')>-1;var app=/ScoreDateApp/.test(navigator.userAgent);if(app)document.documentElement.classList.add('native');if(q||(app&&!sessionStorage.getItem('sd_intro'))){document.documentElement.classList.add('sd-intro');try{sessionStorage.setItem('sd_intro','1')}catch(e){}setTimeout(function(){document.documentElement.classList.remove('sd-intro')},3200)}}catch(e){}})();`;

const CSS = `
#sd-intro{display:none}
html.sd-intro #sd-intro{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(70% 50% at 50% 42%,var(--hero-glow),transparent 70%),var(--onyx);animation:sdi-out .5s ease 2.55s forwards;pointer-events:none}
#sd-intro svg{width:min(260px,70vw);height:auto;overflow:visible}
.sdi-track{fill:none;stroke:var(--track);stroke-width:14;stroke-linecap:round;opacity:.6}
.sdi-seg{fill:none;stroke-width:14;stroke-linecap:round;stroke-dasharray:68.7;stroke-dashoffset:68.7;animation:sdi-draw .45s cubic-bezier(.3,.7,.2,1) forwards}
.sdi-needle{transform-origin:120px 120px;transform:rotate(-88deg);animation:sdi-sweep 1.7s ease-in-out .3s forwards}
.sdi-needle line{stroke:var(--ivory);stroke-width:3;stroke-linecap:round}
.sdi-needle circle{fill:var(--gold)}
.sdi-bands{position:relative;height:22px;width:220px;text-align:center;font:500 14px var(--sans);letter-spacing:.02em}
.sdi-band{position:absolute;inset:0;opacity:0;transform:translateY(6px);animation:sdi-flash .42s ease forwards}
.sdi-band:last-child{animation-name:sdi-stay}
.sdi-band b{font-weight:600}
.sdi-word{font:400 40px/1 var(--serif);color:var(--ivory);opacity:0;transform:translateY(8px);animation:sdi-rise .6s ease 1.75s forwards}
.sdi-word i{color:var(--gold);font-style:normal}
.sdi-tag{font:500 11px var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--faint);opacity:0;animation:sdi-rise .6s ease 1.95s forwards}
@keyframes sdi-draw{to{stroke-dashoffset:0}}
@keyframes sdi-sweep{0%{transform:rotate(-88deg)}12%,20%{transform:rotate(-66deg)}32%,40%{transform:rotate(-22deg)}52%,60%{transform:rotate(22deg)}74%{transform:rotate(72deg)}86%{transform:rotate(64deg)}100%{transform:rotate(68deg)}}
@keyframes sdi-flash{0%{opacity:0;transform:translateY(6px)}30%,70%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-6px)}}
@keyframes sdi-stay{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}
@keyframes sdi-rise{to{opacity:1;transform:none}}
@keyframes sdi-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){
  html.sd-intro #sd-intro{animation-delay:1.1s}
  .sdi-seg{animation:none;stroke-dashoffset:0}
  .sdi-needle{animation:none;transform:rotate(68deg)}
  .sdi-band{animation:none} .sdi-band:last-child{opacity:1;transform:none}
  .sdi-word,.sdi-tag{animation:none;opacity:1;transform:none}
}`;

export default function IntroSplash() {
  return (
    <div id="sd-intro" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg viewBox="0 0 240 140" dangerouslySetInnerHTML={{ __html: `<path class="sdi-track" d="M24 120 A96 96 0 0 1 216 120"/><path class="sdi-seg" d="M24.06 116.65 A96 96 0 0 1 49.79 54.53" stroke="var(--band-building)" style="animation-delay:0.15s"/><path class="sdi-seg" d="M54.53 49.79 A96 96 0 0 1 116.65 24.06" stroke="var(--band-solid)" style="animation-delay:0.33s"/><path class="sdi-seg" d="M123.35 24.06 A96 96 0 0 1 185.47 49.79" stroke="var(--band-strong)" style="animation-delay:0.51s"/><path class="sdi-seg" d="M190.21 54.53 A96 96 0 0 1 215.94 116.65" stroke="var(--band-elite)" style="animation-delay:0.69s"/><g class="sdi-needle"><line x1="120" y1="120" x2="120" y2="44"/><circle cx="120" cy="120" r="7"/></g>` }} />
      <div className="sdi-bands" dangerouslySetInnerHTML={{ __html: `<span class="sdi-band" style="color:var(--band-building);animation-delay:0.36s"><b>Building</b> Under 670</span><span class="sdi-band" style="color:var(--band-solid);animation-delay:0.70s"><b>Solid</b> 670–739</span><span class="sdi-band" style="color:var(--band-strong);animation-delay:1.04s"><b>Strong</b> 740–799</span><span class="sdi-band" style="color:var(--band-elite);animation-delay:1.40s"><b>Elite</b> 800+</span>` }} />
      <div className="sdi-word">Score<i>Date</i></div>
      <div className="sdi-tag">Invite only · New York</div>
    </div>
  );
}
