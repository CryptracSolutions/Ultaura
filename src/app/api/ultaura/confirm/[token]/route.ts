import { NextResponse } from 'next/server';
import { confirmNotificationRecipient } from '~/lib/ultaura/notification-recipients';

function renderPage(options: {
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  isError?: boolean;
}) {
  const button = options.actionLabel && options.actionUrl
    ? `<form method="post" action="${options.actionUrl}">
        <button type="submit">${options.actionLabel}</button>
      </form>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${options.title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .card { max-width: 520px; margin: 48px auto; background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { font-size: 14px; color: #475569; line-height: 1.5; }
      button { margin-top: 18px; background: #14b8a6; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
      .error { color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1 class="${options.isError ? 'error' : ''}">${options.title}</h1>
      <p>${options.body}</p>
      ${button}
    </div>
  </body>
</html>`;
}

export async function GET(_: Request, context: { params: { token: string } }) {
  const token = context.params.token;
  const actionUrl = `/api/ultaura/confirm/${token}`;
  const html = renderPage({
    title: 'Confirm family updates',
    body: 'Confirm that you want to receive weekly summaries and alerts from Ultaura.',
    actionLabel: 'Confirm updates',
    actionUrl,
  });

  return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
}

export async function POST(_: Request, context: { params: { token: string } }) {
  const token = context.params.token;
  const result = await confirmNotificationRecipient(token);

  if (!result.success) {
    const html = renderPage({
      title: 'Confirmation failed',
      body: result.error.message || 'This confirmation link is invalid or expired.',
      isError: true,
    });
    return new NextResponse(html, { headers: { 'content-type': 'text/html' }, status: 400 });
  }

  const html = renderPage({
    title: 'You are confirmed',
    body: `You will now receive updates from ${result.data.accountName}. You can close this page.`,
  });

  return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
}
