import { NextRequest, NextResponse } from 'next/server';
import csrf from 'edge-csrf';

import HttpStatusCode from '~/core/generic/http-status-code.enum';
import configuration from '~/configuration';
import createMiddlewareClient from '~/core/supabase/middleware-client';
import GlobalRole from '~/core/session/types/global-role';

const CSRF_SECRET_COOKIE = 'csrfSecret';
const NEXT_ACTION_HEADER = 'next-action';
const ADMIN_MFA_PATH = '/admin/mfa';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const MFA_TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const MFA_FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|locales|assets|api/chat|api/stripe/webhook|api/search/track).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const csrfResponse = await withCsrfMiddleware(request, response);
  const sessionResponse = await sessionMiddleware(request, csrfResponse);

  return await adminMiddleware(request, sessionResponse);
}

async function sessionMiddleware(req: NextRequest, res: NextResponse) {
  const supabase = createMiddlewareClient(req, res);

  await supabase.auth.getUser();

  return res;
}

async function withCsrfMiddleware(
  request: NextRequest,
  response = new NextResponse(),
) {
  // set up CSRF protection
  const csrfMiddleware = csrf({
    cookie: {
      secure: configuration.production,
      name: CSRF_SECRET_COOKIE,
    },
    // ignore CSRF errors for server actions since protection is built-in
    ignoreMethods: isServerAction(request)
      ? ['POST']
      : // always ignore GET, HEAD, and OPTIONS requests
        SAFE_METHODS,
  });

  const csrfError = await csrfMiddleware(request, response);

  // if there is a CSRF error, return a 403 response
  if (csrfError) {
    return NextResponse.json('Invalid CSRF token', {
      status: HttpStatusCode.Forbidden,
    });
  }

  // otherwise, return the response
  return response;
}

function isServerAction(request: NextRequest) {
  return request.headers.has(NEXT_ACTION_HEADER);
}

async function adminMiddleware(request: NextRequest, response: NextResponse) {
  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith('/admin');

  if (!isAdminPath) {
    return response;
  }

  const supabase = createMiddlewareClient(request, response);
  const { data, error } = await supabase.auth.getUser();
  const origin = request.nextUrl.origin;

  // If user is not logged in, redirect to sign in page.
  // This should never happen, but just in case.
  if (!data.user || error) {
    return NextResponse.redirect(new URL('/auth/sign-in', origin), 307);
  }

  const role = data.user?.app_metadata['role'];

  // If user is not an admin, redirect to 404 page.
  if (!role || role !== GlobalRole.SuperAdmin) {
    return NextResponse.redirect(new URL('/404', origin), 307);
  }

  const shouldEnforceMfa = getEnforceAdminMfa();
  const isAdminMfaPath =
    pathname === ADMIN_MFA_PATH || pathname.startsWith(`${ADMIN_MFA_PATH}/`);

  if (shouldEnforceMfa && !isAdminMfaPath) {
    const { data: assuranceLevel, error: assuranceLevelError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    const isMfaAuthenticated =
      !assuranceLevelError && assuranceLevel?.currentLevel === 'aal2';

    if (!isMfaAuthenticated) {
      return NextResponse.redirect(new URL(ADMIN_MFA_PATH, origin), 307);
    }
  }

  // in all other cases, return the response
  return response;
}

function getEnforceAdminMfa(): boolean {
  const defaultValue = process.env.NODE_ENV === 'production';
  const envValue = process.env.ADMIN_ENFORCE_MFA;

  if (envValue === undefined) {
    return defaultValue;
  }

  const normalizedValue = envValue.trim().toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  if (MFA_TRUE_VALUES.has(normalizedValue)) {
    return true;
  }

  if (MFA_FALSE_VALUES.has(normalizedValue)) {
    return false;
  }

  return defaultValue;
}
