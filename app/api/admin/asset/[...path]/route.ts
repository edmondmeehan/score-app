import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Old links: brand creative now lives at /_creative (staff-only, checked in middleware). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await requireStaff();
  const parts = (await params).path.map(encodeURIComponent).join('/');
  return NextResponse.redirect(new URL(`/_creative/${parts}`, req.url));
}
