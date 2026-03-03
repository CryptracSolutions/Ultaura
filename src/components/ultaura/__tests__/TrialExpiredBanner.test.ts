import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTrans = vi.fn(() => 'Trans');
const mockLink = vi.fn(() => 'Link');

beforeEach(() => {
  vi.resetModules();

  vi.stubGlobal('React', {
    createElement: (
      type: unknown,
      props: Record<string, unknown>,
      ...children: unknown[]
    ) => ({ type, props: { ...props, children } }),
  });

  vi.doMock('next/link', () => ({
    default: mockLink,
  }));

  vi.doMock('lucide-react', () => ({
    AlertTriangle: () => 'AlertTriangle',
    ArrowRight: () => 'ArrowRight',
  }));

  vi.doMock('~/core/ui/Trans', () => ({
    default: mockTrans,
  }));

  mockTrans.mockClear();
  mockLink.mockClear();
});

/**
 * Walk a JSX tree (created by the mocked React.createElement) and collect
 * every element whose `type` matches the given reference.
 */
function collectByType(
  node: unknown,
  target: unknown,
): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  if (!node || typeof node !== 'object') return results;

  const el = node as { type?: unknown; props?: Record<string, unknown> };

  if (el.type === target && el.props) {
    results.push(el.props);
  }

  if (el.props) {
    for (const value of Object.values(el.props)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          results.push(...collectByType(child, target));
        }
      } else {
        results.push(...collectByType(value, target));
      }
    }
  }

  return results;
}

describe('TrialExpiredBanner', () => {
  it('renders trial expired heading', async () => {
    const { TrialExpiredBanner } = await import(
      '~/components/ultaura/TrialExpiredBanner'
    );

    const tree = TrialExpiredBanner();
    const transElements = collectByType(tree, mockTrans);

    const heading = transElements.find(
      (p) => p.i18nKey === 'profile:trialExpiredHeading',
    );

    expect(heading).toBeDefined();
  });

  it('uses all three expected i18n keys', async () => {
    const { TrialExpiredBanner } = await import(
      '~/components/ultaura/TrialExpiredBanner'
    );

    const tree = TrialExpiredBanner();
    const transElements = collectByType(tree, mockTrans);
    const keys = transElements.map((p) => p.i18nKey);

    expect(keys).toContain('profile:trialExpiredHeading');
    expect(keys).toContain('profile:trialExpiredDescription');
    expect(keys).toContain('profile:trialExpiredCta');
  });

  it('links to the subscription settings page', async () => {
    const { TrialExpiredBanner } = await import(
      '~/components/ultaura/TrialExpiredBanner'
    );

    const tree = TrialExpiredBanner();
    const linkElements = collectByType(tree, mockLink);

    expect(linkElements.length).toBeGreaterThan(0);
    expect(linkElements[0]!.href).toBe('/dashboard/settings/subscription');
  });
});
