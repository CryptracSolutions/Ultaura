import { cookies } from 'next/headers';

import {
  verifyTrustedDeviceToken,
  type TrustedDevicePayload,
} from '~/lib/server/trusted-device';

const COOKIE_NAME = 'trusted-device';
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export function setTrustedDeviceCookie(token: string) {
  const secure = process.env.ENVIRONMENT === 'production';

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export function validateTrustedDevice(
  userId: string,
): TrustedDevicePayload | null {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;

  const payload = verifyTrustedDeviceToken(cookie.value, userId);

  if (!payload) clearTrustedDeviceCookie();

  return payload;
}

export function clearTrustedDeviceCookie() {
  cookies().delete(COOKIE_NAME);
}

export function isTrustedDevice(
  userId: string,
  enrolledFactorIds: string[],
): boolean {
  const payload = validateTrustedDevice(userId);
  if (!payload) return false;

  if (!enrolledFactorIds.includes(payload.factorId)) {
    clearTrustedDeviceCookie();
    return false;
  }

  return true;
}
