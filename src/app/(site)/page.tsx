import {
  CheckCircleIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import { UltauraPricingTable } from '~/components/ultaura/PricingTable';
import { withI18n } from '~/i18n/with-i18n';
import { Testimonials } from '~/app/(site)/components/Testimonials';
import { HowItWorks } from '~/app/(site)/components/HowItWorks';
import { MainCallToActionButton } from '~/app/(site)/components/MainCallToActionButton';
import { AudienceValueTabs } from '~/app/(site)/components/AudienceValueTabs';
import { BadgeStrip } from '~/app/(site)/components/BadgeStrip';
import { ReassuranceChecklist } from '~/app/(site)/components/ReassuranceChecklist';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';
import { HeroDashboardPreview } from '~/app/(site)/components/HeroDashboardPreview';

function Home() {
  return (
    <div className={'flex flex-col space-y-[0.055rem]'}>
      {/* Hero Section */}
      <Container>
        <div className="relative mt-6 mb-4 lg:mt-10 lg:mb-6">
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10" />
          <div className="absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10" />
          <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative grid grid-cols-1 items-start gap-8 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
            <div className="flex flex-col space-y-5">
              <Pill>
                <span>Built for families and caregivers</span>
              </Pill>

              <h1 className="text-4xl font-heading font-medium text-foreground md:text-5xl xl:text-6xl 2xl:text-7xl">
                <span className="block leading-[1.1]">
                  You can&apos;t call every day.
                </span>
                <span className="block leading-[1.1] text-transparent bg-gradient-to-br bg-clip-text from-primary to-primary/70">
                  We can.
                </span>
              </h1>

              <SubHeading className={'max-w-2xl'}>
                A friendly voice companion that calls your loved one daily,
                remembers what matters, and keeps you informed — no apps or
                smartphones needed.
              </SubHeading>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <MainCallToActionButton />
                <Button
                  variant="outline"
                  size="lg"
                  round
                  href="/demo"
                  className="border-primary/30 text-primary hover:bg-primary/5"
                >
                  <span className="flex items-center gap-2">
                    <PlayCircleIcon className="h-5 w-5" />
                    Try the voices
                  </span>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>I&apos;m setting this up</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/onboarding?type=self"
                    className="inline-flex min-h-[44px] items-center underline underline-offset-4 hover:text-foreground"
                  >
                    for myself
                  </Link>
                  <span>or</span>
                  <Link
                    href="/onboarding?type=family"
                    className="inline-flex min-h-[44px] items-center underline underline-offset-4 hover:text-foreground"
                  >
                    for someone I care for
                  </Link>
                </div>
              </div>

              <span className={'mt-8 text-xs text-muted-foreground'}>
                3-day free trial • no credit card • cancel anytime
              </span>

              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-primary" />
                  Always discloses AI
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-primary" />
                  No transcripts stored by default
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-primary" />
                  Works on any phone (landlines included)
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-primary" />
                  Quiet hours and scheduling control
                </div>
              </div>
            </div>

            <div className="mt-6 sm:mt-10 lg:mt-0">
              <HeroDashboardPreview />
            </div>
          </div>

        </div>
      </Container>

      <BadgeStrip />

      <AudienceValueTabs />

      {/* How It Works */}
      <HowItWorks />

      <ReassuranceChecklist />

      <Testimonials />

      {/* Pricing Section */}
      <section className="bg-surface-accent py-8">
        <Container>
          <div className="flex flex-col items-center justify-center space-y-8">
            <div className="flex flex-col items-center space-y-4 text-center">
              <Pill>Simple, transparent pricing</Pill>

              <div className="flex flex-col space-y-2.5">
                <Heading type={2}>Choose the <span className="text-primary">plan</span> that fits your family</Heading>

                <SubHeading className="text-sm sm:text-base">
                  <span className="flex flex-col items-center gap-1 text-muted-foreground sm:flex-row sm:gap-2">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-primary" />
                      All plans include a 3-day free trial
                    </span>
                    <span className="text-muted-foreground/80">No credit card required to start</span>
                  </span>
                </SubHeading>
              </div>
            </div>

            <div className="w-full">
              <UltauraPricingTable />
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ Section */}
      <section className="bg-surface-subtle pt-20 pb-8">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <Heading type={2}>Frequently asked <span className="text-primary">questions</span></Heading>
                <SubHeading className="max-w-md">
                  Quick answers about setup, privacy, and how Ultaura keeps
                  conversations respectful.
                </SubHeading>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground">
                    Still need help?
                  </h3>
                  <Link
                    href="/faq"
                    className="mt-2 inline-flex items-center text-sm font-medium text-primary hover:underline"
                  >
                    FAQ →
                  </Link>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We&apos;re happy to talk through voice options, schedules, or
                    anything else. Expect a quick, thoughtful response.
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Voice demos and recommendations
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Billing and line setup questions
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Privacy and safety policies
                    </div>
                  </div>
                  <Button
                    round
                    href="/contact"
                    className="mt-6 w-fit bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Contact Us
                  </Button>
                </div>

              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-background p-6 shadow-sm">
              <Accordion>
                <AccordionItem value="line">
                  <AccordionTrigger className="hover:bg-transparent">
                    What is a line?
                  </AccordionTrigger>
                  <AccordionContent>
                    A line is a verified phone number for one person. Each line
                    represents one loved one who will receive calls from
                    Ultaura.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="call-anytime">
                  <AccordionTrigger className="hover:bg-transparent">
                    Can they call anytime?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes! Your loved one can call Ultaura 24/7 for inbound calls.
                    Scheduled outbound calls respect quiet hours that you
                    configure.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="real-person">
                  <AccordionTrigger className="hover:bg-transparent">
                    Is it a real person?
                  </AccordionTrigger>
                  <AccordionContent>
                    No, Ultaura is an AI voice companion. We always disclose
                    this at the start of each conversation. Ultaura is designed
                    to provide friendly, natural conversation — not to deceive.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="emergencies">
                  <AccordionTrigger className="hover:bg-transparent">
                    What about emergencies?
                  </AccordionTrigger>
                  <AccordionContent>
                    If Ultaura detects distress or concerning language, it
                    gently encourages contacting 988 (mental health crisis
                    line) or 911 for emergencies. Ultaura is not a replacement
                    for emergency services.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="store">
                  <AccordionTrigger className="hover:bg-transparent">
                    Do you store conversations?
                  </AccordionTrigger>
                  <AccordionContent>
                    No transcripts are stored by default. We only keep basic
                    call information (time, duration) visible in your dashboard.
                    Your loved one&apos;s privacy is paramount.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="landlines">
                  <AccordionTrigger className="hover:bg-transparent">
                    Does it work with landlines?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes! Ultaura works with any phone — landlines, cell phones,
                    even flip phones. No smartphone or app is needed.
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </div>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="relative bg-surface-accent py-8 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <Container>
          <div className="relative flex flex-col items-center text-center space-y-4">
            <Heading type={2}>Give the gift of conversation</Heading>
            <SubHeading className="max-w-xl">
              Start your 3-day free trial today and give your loved one a companion
              who&apos;s always there to listen.
            </SubHeading>
            <MainCallToActionButton />
          </div>
        </Container>
      </section>
    </div>
  );
}

export default withI18n(Home);

function Pill(props: React.PropsWithChildren) {
  return (
    <h2
      className={
        'inline-flex w-fit items-center space-x-2' +
        ' rounded-full bg-primary/10 px-4 py-2 text-center text-sm' +
        ' font-medium text-primary'
      }
    >
      <span>{props.children}</span>
    </h2>
  );
}
