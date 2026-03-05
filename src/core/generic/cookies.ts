export function getCookie(name: string) {
  const cookieDict = document.cookie
    .split(';')
    .map((x) => x.split('='))
    .reduce((accum, current) => {
      accum[current[0].trim()] = current[1];
      return accum;
    }, Object());

  return cookieDict[name];
}

export function setCookie(
  name: string,
  value: string,
  options: {
    path?: string;
    expires?: Date;
    sameSite?: 'strict' | 'lax' | 'none';
    httpOnly?: boolean;
    secure?: boolean;
  } = {
    path: '/',
    sameSite: 'lax',
    expires: undefined,
    httpOnly: false,
    secure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : false,
  },
) {
  let cookieText = `${name}=${encodeURIComponent(value)};`;

  if (options.path) {
    cookieText += ` Path=${options.path};`;
  }

  if (options.expires) {
    cookieText += ` Expires=${options.expires.toUTCString()};`;
  }

  if (options.sameSite) {
    cookieText += ` SameSite=${options.sameSite};`;
  }

  if (options.httpOnly) {
    cookieText += ` HttpOnly;`;
  }

  if (options.secure) {
    cookieText += ` Secure;`;
  }

  document.cookie = cookieText;
}
