import { describe, expect, it } from 'vitest';

import renderDashboardAccessInviteEmail from '../dashboard-access-invite';

const baseProps = {
  recipientName: 'Alex',
  accountName: 'Family Account',
  seniorName: 'Martha',
  inviterName: 'Sam',
  signupLink: 'https://example.com/auth/sign-up?inviteCode=abc',
};

describe('renderDashboardAccessInviteEmail', () => {
  it('renders branding and create account CTA', () => {
    const { html } = renderDashboardAccessInviteEmail({
      ...baseProps,
      baseUrl: 'https://example.com',
    });

    expect(html).toContain('Ultaura');
    expect(html).toContain('Create Account');
    expect(html).toContain("Martha&#x27;s care dashboard");
    expect(html).toContain('src="https://example.com/logos/logo-email.png"');
  });

  it('returns a non-empty plain-text fallback', () => {
    const { text } = renderDashboardAccessInviteEmail(baseProps);

    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain('create your free account');
  });
});
