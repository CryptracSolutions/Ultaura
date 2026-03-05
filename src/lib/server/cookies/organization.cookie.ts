import { cookies } from 'next/headers';

const ORGANIZATION_ID_COOKIE_NAME = 'organizationId';
const ORGANIZATION_SELECTION_MODE_COOKIE_NAME = 'organizationSelectionMode';
const MANUAL_SELECTION_MODE = 'manual';

export function createOrganizationIdCookie(params: {
  userId: string;
  organizationUid: string;
}) {
  const secure = process.env.ENVIRONMENT === 'production';

  return {
    name: buildOrganizationIdCookieName(params.userId),
    value: params.organizationUid,
    httpOnly: true,
    secure,
    path: '/',
    sameSite: 'lax' as const,
  };
}

export function createOrganizationSelectionModeCookie(params: { userId: string }) {
  const secure = process.env.ENVIRONMENT === 'production';

  return {
    name: buildOrganizationSelectionModeCookieName(params.userId),
    value: MANUAL_SELECTION_MODE,
    httpOnly: true,
    secure,
    path: '/',
    sameSite: 'lax' as const,
  };
}

/**
 * @name parseOrganizationIdCookie
 * @description Parse the organization UUID cookie from the request
 */
export async function parseOrganizationIdCookie(userId: string) {
  const cookie = cookies().get(
    buildOrganizationIdCookieName(userId)
  );

  return cookie?.value;
}

export async function hasManualOrganizationSelectionCookie(userId: string) {
  const cookie = cookies().get(buildOrganizationSelectionModeCookieName(userId));
  return cookie?.value === MANUAL_SELECTION_MODE;
}

function buildOrganizationIdCookieName(userId: string) {
  return `${userId}-${ORGANIZATION_ID_COOKIE_NAME}`;
}

function buildOrganizationSelectionModeCookieName(userId: string) {
  return `${userId}-${ORGANIZATION_SELECTION_MODE_COOKIE_NAME}`;
}
