export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { subscribeToNewsletter } from '~/lib/ultaura/newsletter';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';

const logger = getLogger();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const subscribeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  source: z.string().default('website'),
});

function getClientIp(request: Request): string {
  // x-real-ip is set by Vercel at the edge and cannot be spoofed by the client.
  // Fall back to first entry of x-forwarded-for (also set by Vercel, but may
  // include client-supplied values in subsequent positions).
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

async function isRateLimited(ip: string): Promise<boolean> {
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });
  const windowStart = new Date(
    Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS,
  ).toISOString();

  const { data: count, error } = await adminClient.rpc(
    'check_newsletter_rate_limit',
    { p_ip: ip, p_window_start: windowStart },
  );

  if (error) {
    logger.warn({ error, ip }, 'Rate limit check failed, allowing request');
    return false;
  }

  return count > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, message: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input.';
    return NextResponse.json(
      { success: false, message: firstError },
      { status: 400 },
    );
  }

  const { email, firstName, source } = parsed.data;
  const userAgent = request.headers.get('user-agent');

  const result = await subscribeToNewsletter({
    email,
    firstName,
    topics: null as Parameters<typeof subscribeToNewsletter>[0]['topics'],
    source,
    ip: ip === 'unknown' ? null : ip,
    userAgent,
  });

  const status = result.success ? 200 : 400;
  return NextResponse.json(
    { success: result.success, message: result.message },
    { status },
  );
}
