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
  } catch {
    return { status: 'review', similarity: null, reason: 'Could not read a face in one of the images' };
  }
}
