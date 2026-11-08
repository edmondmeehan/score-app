import { requireStaff } from '@/lib/session';
import { FOOTER_DEFAULT, MAX_COLUMNS, linksToText, mergeFooter } from '@/lib/footer';
import { SiteFooterView } from '@/components/SiteFooter';
import FooterEditor from './FooterEditor';

export const dynamic = 'force-dynamic';

export default async function FooterAdmin() {
  const { supabase } = await requireStaff();
  const [{ data: role }, { data: row }] = await Promise.all([
    supabase.rpc('staff_role'),
    supabase.from('app_config').select('value').eq('key', 'footer').maybeSingle(),
  ]);
  const f = mergeFooter(row?.value);
  const owner = role === 'owner';
  const cols = Array.from({ length: MAX_COLUMNS }, (_, i) => ({ title: f.columns[i]?.title ?? '', links: linksToText(f.columns[i]?.links ?? []) }));

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Footer</h1>
      <span className="small muted">
        Edit the footer on the website and inside the app. {row ? 'Using your saved version.' : 'Using the built-in default.'} Changes show up within a few seconds and are recorded in the audit log.
        {!owner && ' Only owners can save changes.'}
      </span>
      <FooterEditor
        owner={owner}
        custom={Boolean(row)}
        initial={{ tagline: f.tagline, company: f.company, address: f.address, email: f.email, copyright: f.copyright, disclaimer: f.disclaimer, app_links: linksToText(f.app_links), cols }}
        defaults={{ disclaimer: FOOTER_DEFAULT.disclaimer }}
      />
      <section className="stack" style={{ gap: 10 }}>
        <span className="label">Preview (saved version)</span>
        <div style={{ border: '1px solid var(--line-soft)', borderRadius: 12, overflow: 'hidden' }}>
          <SiteFooterView f={f} />
        </div>
      </section>
    </>
  );
}
