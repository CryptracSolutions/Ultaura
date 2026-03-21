import { escapeHtml, escapeHtmlAttr } from '~/lib/server/html-escape';

export function getSiteUrl(): string {
  const siteUrl =
    process.env.NODE_ENV !== 'production'
      ? process.env.SITE_URL || 'http://localhost:3000'
      : process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return siteUrl.replace(/\/$/, '');
}

type CspDirectives = Record<string, readonly string[]>;
const HEX_COLOR_RE = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function buildContentSecurityPolicy(directives: CspDirectives): string {
  return Object.entries(directives)
    .filter(([, values]) => values.length > 0)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

export function buildHtmlRouteHeaders(options: {
  cspDirectives: CspDirectives;
  contentType?: string;
  extraHeaders?: Record<string, string>;
}): Record<string, string> {
  return {
    'content-type': options.contentType ?? 'text/html; charset=utf-8',
    'content-security-policy': buildContentSecurityPolicy(options.cspDirectives),
    ...(options.extraHeaders ?? {}),
  };
}

function buildActionForm(actionLabel: string, actionUrl: string): string {
  return `<form method="post" action="${escapeHtmlAttr(actionUrl)}"><button type="submit">${escapeHtml(actionLabel)}</button></form>`;
}

export function renderSimpleActionPage(options: {
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  isError?: boolean;
  buttonColor?: string;
}) {
  const safeTitle = escapeHtml(options.title);
  const safeBody = escapeHtml(options.body);
  const safeButtonColor =
    options.buttonColor && HEX_COLOR_RE.test(options.buttonColor)
      ? options.buttonColor
      : '#14b8a6';
  const button =
    options.actionLabel && options.actionUrl
      ? buildActionForm(options.actionLabel, options.actionUrl)
      : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .card { max-width: 520px; margin: 48px auto; background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { font-size: 14px; color: #475569; line-height: 1.5; }
      button { margin-top: 18px; background: ${safeButtonColor}; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
      .error { color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1 class="${options.isError ? 'error' : ''}">${safeTitle}</h1>
      <p>${safeBody}</p>
      ${button}
    </div>
  </body>
</html>`;
}
