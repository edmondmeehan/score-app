import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';
const ROOT = path.join(process.cwd(), 'assets', 'creative');
const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

/** Staff-only download of marketing creative. ?dl=1 forces a download. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await requireStaff();
  const parts = (await params).path;
  const file = path.normalize(path.join(ROOT, ...parts));
  if (!file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response('Not found', { status: 404 });
  try {
    const body = await readFile(file);
    const dl = new URL(req.url).searchParams.has('dl');
    return new Response(new Uint8Array(body), { headers: {
      'content-type': type, 'cache-control': 'private, max-age=3600', 'x-robots-tag': 'noindex',
      ...(dl ? { 'content-disposition': `attachment; filename="${path.basename(file)}"` } : {}),
    } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
