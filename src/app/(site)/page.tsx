import {
  CheckCircleIcon,
  PlayCircleIcon,
  ChatBubbleBottomCenterTextIcon,
  EnvelopeIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

import Image from 'next/image';

import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';

import { withI18n } from '~/i18n/with-i18n';
import { Testimonials } from '~/app/(site)/components/Testimonials';
import { HowItWorks } from '~/app/(site)/components/HowItWorks';
import { MainCallToActionButton } from '~/app/(site)/components/MainCallToActionButton';
import { AudienceValueTabs } from '~/app/(site)/components/AudienceValueTabs';
import { HeroDashboardPreview } from '~/app/(site)/components/HeroDashboardPreview';
import BlendedDemoFrame from '~/app/(site)/components/BlendedDemoFrame';
import { OpenChatCard } from '~/app/(site)/components/OpenChatButton';
import { FadeInWhenVisible, StaggerChildren } from '~/app/(site)/components/MotionWrappers';
import { StatsBar } from '~/app/(site)/components/StatsBar';

function Home() {
  return (
    <div className={'flex flex-col space-y-0'}>
      {/* Hero Section */}
      <Container className="pb-8 lg:pb-0">
        <div className="relative mt-8 mb-6 lg:mt-16 lg:mb-12 lg:min-h-[calc(100svh-80px)] lg:flex lg:items-center">
          <div className="absolute -left-24 top-8 h-96 w-96 rounded-full bg-primary/15 blur-3xl dark:bg-primary/8" />
          <div className="absolute -right-24 bottom-8 h-96 w-96 rounded-full bg-primary/15 blur-3xl dark:bg-primary/8" />
          <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-primary/3 blur-3xl" />

          <div className="relative w-full grid grid-cols-1 items-start gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-10">
            <div className="flex min-w-0 flex-col space-y-5">
              <FadeInWhenVisible>
                <Pill>
                  <span>Companionship, one conversation at a time</span>
                </Pill>
              </FadeInWhenVisible>

              <FadeInWhenVisible delay={0.08}>
                <Heading
                  type={1}
                  className="text-4xl md:text-[2.475rem] xl:text-[3.3rem] 2xl:text-[4.125rem]"
                >
                  <span className="block leading-[1.1]">
                    <span className="block">The call they look</span>
                    <span className="block">forward to.</span>
                  </span>
                  <span className="block leading-[1.1] bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                    <span className="block">The peace of mind</span>
                    <span className="block">you need.</span>
                  </span>
                </Heading>
              </FadeInWhenVisible>

              <FadeInWhenVisible delay={0.14}>
                <SubHeading className={'max-w-2xl'}>
                  Know they&apos;re okay, connected, and looking forward to
                  tomorrow — without rearranging your schedule. Ultaura calls
                  your loved one at the time you choose, reminds them of anything
                  they need, holds great conversations, and keeps you informed.
                </SubHeading>
              </FadeInWhenVisible>

              <FadeInWhenVisible delay={0.18}>
                <p className="text-base text-foreground/80 italic border-l-2 border-primary/40 pl-3">
                  Every quiet day alone is a day their world gets a little smaller.
                </p>
              </FadeInWhenVisible>

              <FadeInWhenVisible delay={0.22} margin="200px">
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
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
              </FadeInWhenVisible>

              <FadeInWhenVisible delay={0.26} margin="200px">
                <span className={'mt-4 text-xs text-center text-primary flex items-center gap-1.5 justify-center sm:justify-start'}>
                  <ShieldCheckIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                  14-day free trial • Start at $19/mo • Cancel anytime
                </span>
              </FadeInWhenVisible>

              <FadeInWhenVisible delay={0.30} margin="200px">
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
                    Control when calls happen — or let them call Ultaura
                  </div>
                </div>
              </FadeInWhenVisible>
            </div>

            <FadeInWhenVisible delay={0.3} direction="right">
              <div className="mt-10 w-full min-w-0 lg:mt-0">
                <BlendedDemoFrame>
                  <HeroDashboardPreview />
                </BlendedDemoFrame>
              </div>
            </FadeInWhenVisible>
          </div>

        </div>
      </Container>

      <div className="mt-12 lg:mt-16">
        <StatsBar />
      </div>

      {/* How It Works */}
      <HowItWorks />

      <AudienceValueTabs />

      <Testimonials />

      {/* Final CTA */}
      <section
        className="relative bg-background py-10 lg:py-14 overflow-hidden"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 50%, var(--surface-accent) 0%, transparent 70%), var(--background)`
        }}
      >
        <Container>
          <div className="relative flex flex-col items-center text-center space-y-4">
            <FadeInWhenVisible>
              <blockquote className="text-lg italic text-muted-foreground text-center max-w-xl mx-auto">
                <p>&ldquo;Nana can&apos;t wait for mornings now.&rdquo;</p>
                <footer className="mt-2 flex items-center justify-center gap-2 not-italic">
                  <Image
                    src="/images/testimonials/aisha-n.webp"
                    alt="Aisha N."
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span className="text-xs text-muted-foreground">Aisha N., Granddaughter</span>
                </footer>
              </blockquote>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.08}>
              <Heading type={2}>Give the gift of conversation</Heading>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.15}>
              <SubHeading className="max-w-xl">
                Set up in 5 minutes. Cancel anytime, no commitment. Their first
                call can happen today.
              </SubHeading>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.22}>
              <MainCallToActionButton />
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.28}>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1">
                  <ShieldCheckIcon className="h-4 w-4 text-primary" />
                  HIPAA Compliant
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1">
                  <LockClosedIcon className="h-4 w-4 text-primary" />
                  SOC 2 Certified
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1">
                  <CheckCircleIcon className="h-4 w-4 text-primary" />
                  AARP Recognized
                </span>
              </div>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.34}>
              <span className="bg-background/50 rounded-full px-4 py-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                Free for 14 days · Cancel anytime · Works on any phone
              </span>
            </FadeInWhenVisible>
          </div>
        </Container>
      </section>

      {/* Support Channels */}
      <section className="bg-background py-16 lg:py-20">
        <Container>
          <div className="flex flex-col items-center space-y-6">
            <Heading type={2}>
              Need help?{' '}
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                We&apos;ve got you
              </span>
            </Heading>

            <StaggerChildren className="grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3 [&>div]:w-full">
              {/* Live Chat */}
              <OpenChatCard className="h-full w-full min-h-[96px] group flex items-center gap-4 rounded-2xl border border-border/60 bg-sidebar px-6 py-4 text-left shadow-xl transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 hover:shadow-2xl">
                <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 transition-colors duration-200 group-hover:bg-primary">
                  <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-primary transition-colors duration-200 group-hover:text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Chat with Ultaura</h3>
                  <p className="text-xs text-muted-foreground">Reply in seconds</p>
                  <p className="mt-1 text-xs font-medium text-primary">Start a conversation &rarr;</p>
                </div>
              </OpenChatCard>

              {/* Email */}
              <a
                href="mailto:support@ultaura.com"
                className="h-full w-full min-h-[96px] group flex items-center gap-4 rounded-2xl border border-border/60 bg-sidebar px-6 py-4 shadow-xl transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 transition-colors duration-200 group-hover:bg-primary">
                  <EnvelopeIcon className="h-5 w-5 text-primary transition-colors duration-200 group-hover:text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Email us</h3>
                  <p className="text-xs text-muted-foreground">Speak to the team directly</p>
                  <p className="mt-1 text-xs font-medium text-primary">support@ultaura.com &rarr;</p>
                </div>
              </a>

              {/* FAQ */}
              <a
                href="/faq"
                className="h-full w-full min-h-[96px] group flex items-center gap-4 rounded-2xl border border-border/60 bg-sidebar px-6 py-4 shadow-xl transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 transition-colors duration-200 group-hover:bg-primary">
                  <BookOpenIcon className="h-5 w-5 text-primary transition-colors duration-200 group-hover:text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Browse FAQs</h3>
                  <p className="text-xs text-muted-foreground">Find answers to most questions here</p>
                  <p className="mt-1 text-xs font-medium text-primary">Visit FAQ page &rarr;</p>
                </div>
              </a>
            </StaggerChildren>
          </div>
        </Container>
      </section>
    </div>
  );
}

export default withI18n(Home);

function Pill({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <h2
      className={`inline-flex w-fit items-center space-x-2 rounded-full bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary${className ? ` ${className}` : ''}`}
    >
      <span>{children}</span>
    </h2>
  );
}
