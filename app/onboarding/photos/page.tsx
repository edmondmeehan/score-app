import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { Steps, TestBanner } from '@/components/ui';
import { faceMatchConfigured } from '@/lib/facematch';
import PhotoUploader from './PhotoUploader';

export default async function Photos() {
  const { me } = await getMe();
  if (!me) redirect('/signin');
  return (
    <div className="phone">
      <Steps at={5} />
      <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.05 }}>Add your photos</h1>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>Take a quick live selfie, then add up to 6 photos. AI checks each photo against your selfie so every profile is really the person on it. The selfie is used for the check and then discarded.</p>
      {!(await faceMatchConfigured()) && <TestBanner>Face matching isn&apos;t connected yet, so photos go to a person on our team for review.</TestBanner>}
      <PhotoUploader />
    </div>
  );
}
