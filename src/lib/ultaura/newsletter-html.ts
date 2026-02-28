import { escapeHtml, escapeHtmlAttr } from '~/lib/server/html-escape';

const DEFAULT_SITE_URL = 'http://localhost:3000';
const SITE_URL = escapeHtmlAttr(
  (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, ''),
);

function buildActionForm(actionLabel: string, actionUrl: string): string {
  return `<form method="post" action="${escapeHtmlAttr(actionUrl)}"><button type="submit">${escapeHtml(actionLabel)}</button></form>`;
}

export function renderNewsletterActionPage(options: {
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  isError?: boolean;
  compatibilityNotice?: string;
}) {
  const safeTitle = escapeHtml(options.title);
  const safeBody = escapeHtml(options.body);
  const safeCompatibilityNotice = options.compatibilityNotice
    ? `<p class="compat">${escapeHtml(options.compatibilityNotice)}</p>`
    : '';
  const button =
    options.actionLabel && options.actionUrl
      ? buildActionForm(options.actionLabel, options.actionUrl)
      : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: Manrope, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fafaf9; color: #0f172a; }
      .card { max-width: 520px; margin: 48px auto; background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #E7E5E4; }
      .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
      .logo span { font-size: 18px; font-weight: 700; color: #0f172a; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { font-size: 14px; color: #475569; line-height: 1.5; }
      button { margin-top: 18px; background: #0ABAB5; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-family: inherit; font-weight: 600; cursor: pointer; }
      button:hover { opacity: 0.9; }
      .error { color: #b91c1c; }
      .compat { margin-top: 10px; font-size: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">
        <img src="${SITE_URL}/logos/logo-email.png" width="36" height="36" alt="Ultaura" />
        <span>Ultaura</span>
      </div>
      <h1 class="${options.isError ? 'error' : ''}">${safeTitle}</h1>
      <p>${safeBody}</p>
      ${safeCompatibilityNotice}
      ${button}
    </div>
  </body>
</html>`;
}
