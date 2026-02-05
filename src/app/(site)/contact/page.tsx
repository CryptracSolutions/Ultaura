import Link from 'next/link';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { withI18n } from '~/i18n/with-i18n';

import ContactForm from './ContactForm';

export const metadata = {
  title: 'Contact - Ultaura',
  description:
    'Contact the Ultaura team for support, billing questions, or help getting started.',
};

const SUPPORT_EMAIL = 'support@ultaura.com';

function ContactPage() {
  return (
    <div className="flex flex-col space-y-24 pb-24">
      <div className="bg-primary/10 py-24">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <Heading type={1}>Contact Ultaura</Heading>
            <SubHeading className="max-w-2xl mx-auto">
              Tell us what you need and we&apos;ll get back to you quickly. We
              typically respond in under 2 hours.
            </SubHeading>
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
              <span>Response time: &lt; 2 hours</span>
              <span className="hidden sm:inline">•</span>
              <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </Container>
      </div>

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
                title="Safety Note"
                description="Ultaura isn&apos;t an emergency service. If someone is in immediate danger, call 911. For mental health crises, call or text 988."
              />
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
