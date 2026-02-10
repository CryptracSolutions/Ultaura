import { describe, expect, it } from 'vitest';

import { renderBroadcastHtmlEmail } from '../newsletter-broadcast';

describe('renderBroadcastHtmlEmail', () => {
  it('includes core Ultaura branding and unsubscribe marker', () => {
    const { html } = renderBroadcastHtmlEmail({
      subject: 'Weekly Care Update',
      topicLabel: 'Elder Care Tips',
      htmlContent: '<p>Hello families</p>',
      unsubscribeUrl: 'https://example.com/unsub',
    });

    expect(html).toContain('Ultaura');
    expect(html).toContain('Companionship, one call at a time.');
    expect(html).toContain('Unsubscribe');
  });

  it('injects HTML content without escaping nested tags', () => {
    const { html } = renderBroadcastHtmlEmail({
      subject: 'Product Notes',
      topicLabel: 'Product Updates',
      htmlContent:
        '<p>Please read the <strong>important</strong> note and <a href="https://example.com/details">details</a>.</p>',
      unsubscribeUrl: 'https://example.com/unsub',
    });

    expect(html).toContain('<strong>important</strong>');
    expect(html).toContain('href="https://example.com/details"');
    expect(html).not.toContain('&lt;strong&gt;important&lt;/strong&gt;');
  });

  it('preserves the resend unsubscribe placeholder token', () => {
    const { html } = renderBroadcastHtmlEmail({
      subject: 'Monthly Roundup',
      topicLabel: 'Blog Digest',
      htmlContent: '<p>Roundup</p>',
      unsubscribeUrl: '{{{RESEND_UNSUBSCRIBE_URL}}}',
    });

    expect(html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
  });

  it('returns a non-empty plain-text fallback containing subject semantics', () => {
    const subject = 'Important Family Update';
    const { text } = renderBroadcastHtmlEmail({
      subject,
      topicLabel: 'Blog Digest',
      htmlContent: '<p>We have updates for you.</p>',
      unsubscribeUrl: 'https://example.com/unsub',
    });

    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain(subject.toLowerCase());
  });
});
