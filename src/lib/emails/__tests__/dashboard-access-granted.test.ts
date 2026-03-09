import { describe, expect, it } from 'vitest';

import renderDashboardAccessGrantedEmail from '../dashboard-access-granted';

const baseProps = {
  recipientName: 'Alex',
  accountName: 'Family Account',
  seniorName: 'Martha',
  inviterName: 'Sam',
  loginLink: 'https://example.com/auth/sign-in?next=/dashboard',
};

describe('renderDashboardAccessGrantedEmail', () => {
  it('renders branding and view dashboard CTA', () => {
    const { html } = renderDashboardAccessGrantedEmail({
      ...baseProps,
      baseUrl: 'https://example.com',
    });

    expect(html).toContain('Ultaura');
    expect(html).toContain('View Dashboard');
    expect(html).toContain("Martha&#x27;s care dashboard");
    expect(html).toContain('src="data:image/png;base64,');
  });

  it('returns a non-empty plain-text fallback', () => {
    const { text } = renderDashboardAccessGrantedEmail(baseProps);

    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain('log in to start viewing');
  });
});
