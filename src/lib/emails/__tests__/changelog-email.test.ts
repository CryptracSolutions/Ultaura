import { describe, expect, it } from 'vitest';

import { renderChangelogEmail } from '../changelog';

describe('renderChangelogEmail', () => {
  it('renders branded HTML with changelog entries and no unsubscribe footer', () => {
    const { html } = renderChangelogEmail({
      entries: [
        {
          title: 'Recurring Reminders',
          description: 'Set up daily, weekly, or custom reminders that repeat automatically.',
          category: 'new_feature',
        },
      ],
      dashboardUrl: 'https://example.com/dashboard',
      baseUrl: 'https://example.com',
    });

    expect(html).toContain('Ultaura');
    expect(html).toContain("What&#x27;s New");
    expect(html).toContain('Recurring Reminders');
    expect(html).toContain('View Your Dashboard');
    expect(html).toContain('Companionship, one call at a time.');
    expect(html).not.toContain('Unsubscribe');
  });

  it('returns a non-empty plain text fallback with entry text', () => {
    const { text } = renderChangelogEmail({
      entries: [
        {
          title: 'Scheduler reliability improvements',
          description: 'Fewer duplicate triggers during retries.',
          category: 'improvement',
        },
      ],
      dashboardUrl: 'https://example.com/dashboard',
    });

    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain('scheduler reliability improvements');
    expect(text.toLowerCase()).toContain("what's new");
  });
});
