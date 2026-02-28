import { describe, expect, it } from 'vitest';
import { renderSimpleActionPage } from '~/lib/server/route-html';
import { renderNewsletterActionPage } from '~/lib/ultaura/newsletter-html';

const UNSAFE_ACTION_PATH = '/api/test/" onclick="alert(1)`';
const UNSAFE_NEWSLETTER_ACTION_PATH =
  '/api/newsletter/unsubscribe/abc/" onclick="alert(1)`';

describe('route html renderers', () => {
  it('escapes action URL for attribute context', () => {
    const html = renderSimpleActionPage({
      title: 'Title',
      body: 'Body',
      actionLabel: 'Continue',
      actionUrl: UNSAFE_ACTION_PATH,
    });

    expect(html).toContain(
      'action="/api/test/&quot; onclick=&quot;alert(1)&#96;"',
    );
    expect(html).not.toContain('onclick="alert(1)"');
  });

  it('sanitizes buttonColor with safe fallback', () => {
    const withValidColor = renderSimpleActionPage({
      title: 'Title',
      body: 'Body',
      buttonColor: '#0f172a',
    });
    const withInvalidColor = renderSimpleActionPage({
      title: 'Title',
      body: 'Body',
      buttonColor: 'red;transform:rotate(1deg)',
    });

    expect(withValidColor).toContain('background: #0f172a;');
    expect(withInvalidColor).toContain('background: #14b8a6;');
    expect(withInvalidColor).not.toContain('transform:rotate');
  });

  it('escapes newsletter action URL for attribute context', () => {
    const html = renderNewsletterActionPage({
      title: 'Title',
      body: 'Body',
      actionLabel: 'Unsubscribe',
      actionUrl: UNSAFE_NEWSLETTER_ACTION_PATH,
    });

    expect(html).toContain(
      'action="/api/newsletter/unsubscribe/abc/&quot; onclick=&quot;alert(1)&#96;"',
    );
    expect(html).not.toContain('onclick="alert(1)"');
  });
});
