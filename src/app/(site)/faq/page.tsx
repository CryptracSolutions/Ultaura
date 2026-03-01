import type { Metadata } from 'next';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import { PageHero, GradientText } from '~/app/(site)/components/PageHero';
import { FAQ_DATA } from './faq-data';
import { FAQLayout } from './components/FAQLayout';

export const metadata: Metadata = {
  title: 'FAQ - Ultaura',
  description:
    'Everything you need to know about Ultaura — how calls work, privacy, safety monitoring, pricing, and setup. Answers to 30+ common questions.',
  alternates: {
    canonical: '/faq',
  },
};

function FAQPage() {
  const allItems = FAQ_DATA.flatMap((category) => category.items);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <div>
      <script
        key={'ld:json'}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <PageHero
        badge="FAQ"
        title={
          <>
            Frequently Asked <GradientText>Questions</GradientText>
          </>
        }
        subtitle="Everything you need to know about Ultaura and how it works."
      />

      {/* FAQ Content with Sidebar */}
      <div className="py-16 lg:py-20">
        <div className="container mx-auto px-container">
          <FAQLayout categories={FAQ_DATA} />
        </div>
      </div>

      {/* CTA Section */}
      <section className="pb-24">
        <Container>
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <Heading type={2}>Ready to get started?</Heading>
            <p className="text-lg text-muted-foreground">
              Give your loved one a companion who&apos;s always happy to listen.
              Start with a 14-day free trial. Cancel anytime.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" round href="/auth/sign-up">
                Start 14-day free trial
              </Button>
              <Button
                size="lg"
                round
                variant="outline"
                href="/pricing"
                className="border-primary/30 text-primary hover:bg-primary/5"
              >
                View Pricing
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 justify-center text-sm text-muted-foreground">
              {['Works on any phone', 'No app required', 'Cancel anytime'].map(
                (item) => (
                  <span key={item} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 text-primary" />
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

export default FAQPage;
