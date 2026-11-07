'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export async function submitStory(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');
  const consent = form.get('consent') === 'on';
  const headline = String(form.get('headline') || '').trim();
  const story = String(form.get('story') || '').trim();
  const back = (msg: string) => redirect('/app/discover/stories?error=' + encodeURIComponent(msg) + '#share');
  if (!consent) back('Tick the box so we can share your story.');
  if (headline.length < 3) back('Add a short headline.');
  if (story.length < 40) back('Tell us a little more (at least a couple of sentences).');
  const { error } = await supabase.from('success_stories').insert({
    user_id: user.id, headline: headline.slice(0, 120), story: story.slice(0, 2000), consent,
    partner_first_name: String(form.get('partner_first_name') || '').trim().slice(0, 40) || null,
    show_names: form.get('show_names') === 'on', partner_consent: form.get('partner_consent') === 'on',
  });
  if (error) back('Something went wrong. Try again.');
  redirect('/app/discover/stories?sent=1');
}
