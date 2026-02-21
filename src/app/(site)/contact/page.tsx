import Link from 'next/link';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import { withI18n } from '~/i18n/with-i18n';
import { PageHero, GradientText } from '~/app/(site)/components/PageHero';

import ContactForm from './ContactForm';

export const metadata = {
  title: 'Contact - Ultaura',
  description:
    'Contact Ultaura for support, billing questions, or help setting up calls for your loved one. Response time under 2 hours.',
};

const SUPPORT_EMAIL = 'support@ultaura.com';

function ContactPage() {
  return (
    <div className="flex flex-col space-y-24 pb-24">
      <PageHero
        badge="GET IN TOUCH"
        title={
          <>
            Contact <GradientText>Ultaura</GradientText>
          </>
        }
        subtitle="Tell us what you need and we'll get back to you quickly."
      >
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          <span>Response time: &lt; 2 hours</span>
          <span className="hidden sm:inline">•</span>
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </PageHero>

      <Container>
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="space-y-3">
              <Heading type={2}>Send a message</Heading>
              <p className="text-muted-foreground text-lg">
                Share a few details and we&apos;ll route your request to the right
                person. If it&apos;s about a specific line, include the phone
                number.
              </p>
            </div>
            <ContactForm />
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <Heading type={2}>Other ways to reach us</Heading>
              <p className="text-muted-foreground text-lg">
                Prefer self-serve or need immediate help? Start here.
              </p>
            </div>

            <div className="space-y-4">
              <InfoCard
                title="Help Center"
                description="Guides for scheduling, reminders, trusted contacts, and privacy."
              >
                <Link className="underline" href="/docs">
                  Visit the Help Center →
                </Link>
              </InfoCard>

              <InfoCard
                title="Email Support"
                description="Prefer to email us directly? Best for billing, account changes, and technical issues."
              >
                <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </InfoCard>

              <InfoCard
                title="Mailing Address"
                description="For official correspondence."
              >
                <p className="text-sm text-foreground">
                  Ultaura
                  <br />
                  725 Joralemon St Unit 127
                  <br />
                  Belleville, NJ 07109
                </p>
              </InfoCard>

            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

function InfoCard({
  title,
  description,
  children,
}: React.PropsWithChildren<{ title: string; description: string }>) {
  return (
    <div className="rounded-2xl border border-border/60 bg-sidebar p-6 space-y-3 shadow-xl">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children ? (
        <div className="text-sm text-foreground">{children}</div>
      ) : null}
    </div>
  );
}

export default withI18n(ContactPage);
