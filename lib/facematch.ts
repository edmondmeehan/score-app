import 'server-only';
import { RekognitionClient, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { getIntegration } from '@/lib/integrations';

export async function faceMatchConfigured() {
  const i = await getIntegration('aws');
  return Boolean(i.enabled && i.secrets.access_key_id && i.secrets.secret_access_key);
}

export type MatchResult = { status: 'approved' | 'review'; similarity: number | null; reason: string };

/**
 * Compare a live selfie with a profile photo. The selfie is held in memory only and never stored.
 * We never auto-reject: low or no match goes to a person for review.
 */
export async function compareFaces(selfie: Uint8Array, photo: Uint8Array): Promise<MatchResult> {
  const i = await getIntegration('aws');
  if (!(i.enabled && i.secrets.access_key_id && i.secrets.secret_access_key)) return { status: 'review', similarity: null, reason: 'Face match not connected; sent to manual review' };
  const threshold = Number(i.config.approve_threshold || 92);
  const client = new RekognitionClient({
    region: i.config.region || 'us-east-1',
    credentials: { accessKeyId: i.secrets.access_key_id, secretAccessKey: i.secrets.secret_access_key },
  });
  try {
    const out = await client.send(new CompareFacesCommand({ SourceImage: { Bytes: selfie }, TargetImage: { Bytes: photo }, SimilarityThreshold: 70 }));
    const best = Math.max(0, ...(out.FaceMatches || []).map((m) => m.Similarity || 0));
    if (best >= threshold) return { status: 'approved', similarity: Math.round(best * 10) / 10, reason: 'Strong match' };
    return { status: 'review', similarity: best ? Math.round(best * 10) / 10 : null, reason: best ? 'Weak match' : 'No matching face found' };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    // Image problems are normal (no face, unsupported file); anything else means AWS itself failed.
    if (err.name === 'InvalidParameterException' || err.name === 'InvalidImageFormatException' || err.name === 'ImageTooLargeException') {
      return { status: 'review', similarity: null, reason: 'Could not read a face in one of the images' };
    }
    console.error('[facematch] AWS error:', err.name, err.message);
    const msg = err.message || '';
    const why = /service control policy/i.test(msg) ? 'blocked by an AWS Organizations policy (SCP) on this account'
      : /permissions boundary/i.test(msg) ? 'blocked by a permissions boundary on the IAM user'
      : /explicit deny/i.test(msg) ? 'blocked by an explicit Deny policy'
      : /no identity-based policy allows/i.test(msg) ? 'the IAM user has no policy allowing rekognition:CompareFaces'
      : /security token|signature|InvalidClientTokenId/i.test(msg + err.name) ? 'the access key or secret is wrong'
      : msg.slice(0, 140);
    return { status: 'review', similarity: null, reason: `AWS error: ${err.name || 'unknown'} · ${why}` };
  }
}
