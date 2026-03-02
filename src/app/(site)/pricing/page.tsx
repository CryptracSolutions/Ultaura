import { CheckCircleIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import { UltauraPricingTable } from '~/components/ultaura/PricingTable';
import { withI18n } from '~/i18n/with-i18n';
import { PageHero, GradientText } from '~/app/(site)/components/PageHero';

export const metadata = {
  title: 'Pricing - Ultaura Voice Companion',
  description:
    'Simple, transparent pricing for Ultaura AI voice companion. Plans from $19/month — about $0.63/day. 14-day free trial. More affordable than in-home care.',
};

const CERTAINTY_ITEMS = [
  'Your 14-day trial includes up to 20 minutes of calls per day and reminders. Billing starts when the trial ends.',
  'If you go over your included minutes, we\'ll notify you first. Overage is $0.15 per minute — no hidden fees.',
  'Cancel anytime from your dashboard in one click. Service continues through the end of your billing period.',
  'Switch between monthly and annual billing anytime. Annual plans save 20%.',
  'Your data is always yours. Export or delete it from the Privacy Center at any time.',
  'Upgrade, downgrade, or switch plans anytime. Changes take effect at the start of your next billing cycle.',
];

const productStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Ultaura AI Voice Companion',
  description:
    'AI-powered daily phone companion for seniors providing conversation, reminders, and safety monitoring',
  brand: { '@type': 'Brand', name: 'Ultaura' },
  offers: [
    {
      '@type': 'Offer',
      name: 'Care Plan',
      price: '19.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Comfort Plan',
      price: '49.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Family Plan',
      price: '99.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Pay As You Go',
      price: '0.00',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '0.15',
        priceCurrency: 'USD',
        unitText: 'per minute',
      },
      availability: 'https://schema.org/InStock',
    },
  ],
};

function PricingPage() {
  return (
    <div>
      <script
        key="ld:json:product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData) }}
      />

      <PageHero
        badge="PRICING"
        title={
          <>
            Simple, <GradientText>Transparent</GradientText> Pricing
          </>
        }
      >
        <span className="flex flex-col items-center gap-1 text-sm sm:text-base text-muted-foreground sm:flex-row sm:gap-2">
          <span className="inline-flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-primary" />
            All plans include a 14-day free trial
          </span>
        </span>
      </PageHero>

      <Container>
        <div className="my-8">
          <UltauraPricingTable />
        </div>

        {/* Certainty block */}
        <section className="mt-12 mb-16 rounded-2xl border border-border/60 bg-sidebar shadow-xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
            No surprises. Here&apos;s exactly what to expect.
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {CERTAINTY_ITEMS.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </div>
  );
}

export default withI18n(PricingPage);
