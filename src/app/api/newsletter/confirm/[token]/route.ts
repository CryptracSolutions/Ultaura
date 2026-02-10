export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { confirmSubscription } from '~/lib/ultaura/newsletter';

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

function renderPage(options: {
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  isError?: boolean;
}) {
  const button =
    options.actionLabel && options.actionUrl
      ? `<form method="post" action="${options.actionUrl}">
          <button type="submit">${options.actionLabel}</button>
        </form>`
      : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>${options.title}</title>
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
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">
        <img src="${siteUrl}/logos/logo-email.png" width="36" height="36" alt="Ultaura" />
        <span>Ultaura</span>
      </div>
      <h1 class="${options.isError ? 'error' : ''}">${options.title}</h1>
      <p>${options.body}</p>
      ${button}
    </div>
  </body>
</html>`;
}

export async function GET(
  _: Request,
  context: { params: { token: string } },
) {
  const token = context.params.token;
  const actionUrl = `/api/newsletter/confirm/${token}`;

  const html = renderPage({
    title: 'Confirm your subscription',
    body: 'Click the button below to confirm your Ultaura newsletter subscription.',
    actionLabel: 'Confirm Subscription',
    actionUrl,
  });

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html' },
  });
}

export async function POST(
  request: Request,
  context: { params: { token: string } },
) {
  const token = context.params.token;
  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  const userAgent = request.headers.get('user-agent');

  const result = await confirmSubscription(token, ip, userAgent);

  if (!result.success) {
    const html = renderPage({
      title: 'Confirmation failed',
      body: result.message || 'This confirmation link is invalid or expired.',
      isError: true,
    });

    return new NextResponse(html, {
      headers: { 'content-type': 'text/html' },
      status: 400,
    });
  }

  return NextResponse.redirect(`${siteUrl}/newsletter/confirmed`);
}
