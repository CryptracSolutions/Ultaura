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
                <span>Designed with elder care professionals and family caregivers</span>
              </Pill>

              <h1 className="text-[2.0625rem] font-heading font-medium text-foreground md:text-[2.475rem] xl:text-[3.3rem] 2xl:text-[4.125rem]">
                <span className="block leading-[1.1]">
                  The call they look forward to.
                </span>
                <span className="block leading-[1.1] text-transparent bg-gradient-to-br bg-clip-text from-primary to-primary/70">
                  The peace of mind you need.
                </span>
              </h1>

              <SubHeading className={'max-w-2xl'}>
                Know they&apos;re okay, connected, and looking forward to
                tomorrow — without rearranging your schedule. Ultaura calls
                your loved one at the time you choose, reminds them of anything
                they need, holds great conversations, and keeps you informed.
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

              <p className="text-sm text-muted-foreground">
                I&apos;m setting this up{' '}
                <Link
                  href="/onboarding?type=self"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  for myself
                </Link>
                {' '}or{' '}
                <Link
                  href="/onboarding?type=family"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  for someone I care for
                </Link>
              </p>

              <span className={'mt-8 text-xs text-muted-foreground'}>
                3-day free trial • no credit card • cancel anytime
              </span>

              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
                  Always identifies as AI — never pretends to be human
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
                  Conversations stay private — no recordings, no transcripts
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
                  Works on any phone, including landlines
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
                  Control when calls happen — quiet hours built in
                </div>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <HeroDashboardPreview />
            </div>
          </div>

        </div>
      </Container>

      <BadgeStrip />

      {/* How It Works */}
      <HowItWorks />

      <AudienceValueTabs />

      <ReassuranceChecklist />

      <Testimonials />

      {/* Pricing Section */}
      <section className="bg-surface-accent py-8">
        <Container>
          <div className="flex flex-col items-center justify-center space-y-8">
            <div className="flex flex-col items-center space-y-4 text-center">
              <Pill>Simple, transparent pricing</Pill>

              <div className="flex flex-col space-y-2.5">
                <Heading type={2}>Choose a <span className="text-primary">plan</span> that fits your needs</Heading>

                <SubHeading className="text-sm sm:text-base">
                  <span className="flex flex-col items-center gap-1 text-muted-foreground sm:flex-row sm:gap-2">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-primary" />
                      All plans include a 3-day free trial
                    </span>
                    <span className="text-muted-foreground/80">No credit card required to start</span>
                  </span>
                </SubHeading>
                <p className="text-sm text-muted-foreground mt-2">
                  Home care aides average $30/hour. Ultaura starts at $39/month.
                </p>
              </div>
            </div>

            <div className="w-full">
              <UltauraPricingTable />
            </div>
          </div>
        </Container>
      </section>

      {/* Need Help Section */}
      <section className="bg-surface-subtle py-16">
        <Container>
          <div className="flex flex-col items-center text-center">
            <Heading type={2}>Questions<span className="text-primary">?</span></Heading>
            <Link
              href="/faq"
              className="mt-4 inline-flex items-center text-2xl font-medium text-primary hover:underline"
            >
              FAQ →
            </Link>

            <div className="mt-8 w-full max-w-7xl rounded-2xl border border-border/60 bg-sidebar px-4 py-5 sm:px-8 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">
                Still need help?
              </h3>
              <p className="mt-4 text-sm text-muted-foreground">
                We&apos;re happy to talk through voice options, schedules, or
                anything else. Expect a quick, thoughtful response.
              </p>
              <div className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:justify-center sm:gap-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Voice demos and recommendations
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Billing and line setup questions
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Privacy and safety policies
                </div>
              </div>
              <Button
                round
                href="/contact"
                className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Chat with us
              </Button>
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
              Set up in 5 minutes. No credit card, no commitment. Their first
              call can happen today.
            </SubHeading>
            <MainCallToActionButton />
            <span className="text-xs text-muted-foreground">
              Free for 3 days · Cancel anytime · Works on any phone
            </span>
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
