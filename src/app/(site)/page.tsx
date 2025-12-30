import {
  CheckCircleIcon,
  MicrophoneIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';

function Home() {
  return (
    <div className={'flex flex-col space-y-16'}>
      {/* Hero Section */}
      <Container>
        <div className="relative my-12 lg:my-20">
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10" />
          <div className="absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10" />
          <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="flex flex-col space-y-6">
              <Pill>
                <span>
                  AI-powered <span className="text-primary">companionship</span>{' '}
                  for your loved ones
                </span>
              </Pill>

              <h1 className="text-4xl font-heading font-medium text-foreground md:text-5xl xl:text-6xl 2xl:text-7xl">
                <span className="block leading-[1.1]">
                  <span className="text-primary">Companionship</span>
                </span>
                <span className="block leading-[1.1]">for your</span>
                <span className="block leading-[1.1] text-transparent bg-gradient-to-br bg-clip-text from-primary to-primary/70">
                  loved ones
                </span>
              </h1>

              <SubHeading className={'max-w-2xl'}>
                <span>Peace of mind for caregivers.</span>
                <span>
                  Warm, natural phone calls to your parent or grandparent — no app required
                </span>
              </SubHeading>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

              <span className={'text-xs text-muted-foreground'}>
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

            <div className="relative">
              <div className="rounded-3xl border border-border/60 bg-sidebar p-6 shadow-xl">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-[0.18em]">Live call</span>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                    In progress
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-background p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-end gap-1">
                        {[3, 7, 4, 8, 5, 10, 6, 9, 4, 7, 3, 8].map((height, i) => (
                          <span
                            key={i}
                            className="w-2 rounded-full bg-primary"
                            style={{ height: `${height + 6}px` }}
                          />
                        ))}
                      </div>

                      <span className="text-xs tabular-nums text-muted-foreground">
                        02:18
                      </span>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-start gap-4 rounded-2xl bg-background p-4 text-left">
                    <div className="rounded-xl border border-primary/10 bg-primary/10 p-3 text-primary">
                      <MicrophoneIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Warm voice</div>
                      <div className="text-xs text-muted-foreground">
                        Soft, friendly cadence
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {['Ara', 'Rex', 'Sal', 'Eve', 'Leo'].map((chip) => (
                      <span
                        key={chip}
                        className={
                          'rounded-full border border-border bg-background px-3 py-1' +
                          (chip === 'Ara'
                            ? ' border-primary/40 bg-primary/10 text-primary'
                            : '')
                        }
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background p-4">
                    <div className="text-xs text-muted-foreground">
                      Recent activity
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                        Today 6:30 PM
                      </span>
                      <span className="text-muted-foreground">Tue 6:30 PM</span>
                      <span className="text-muted-foreground">Sun 5:00 PM</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background p-4">
                    <div className="text-xs text-muted-foreground">
                      Caregiver view
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      18 min call • calm mood
                    </div>
                  </div>

                  <div className="hidden rounded-2xl border border-border/60 bg-background p-4 lg:block">
                    <div className="text-xs text-muted-foreground">
                      Weekly trend
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-primary/30" />
                      <div className="h-2 w-12 rounded-full bg-primary/60" />
                      <div className="h-2 w-6 rounded-full bg-primary" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </Container>

      <AudienceValueTabs />

      {/* How It Works */}
      <HowItWorks />

      <Testimonials />

      {/* Pricing Section */}
      <section className="bg-surface-accent py-16">
        <Container>
          <div className="flex flex-col items-center justify-center space-y-16">
            <div className="flex flex-col items-center space-y-8 text-center">
              <Pill>Simple, transparent pricing</Pill>

              <div className="flex flex-col space-y-2.5">
                <Heading type={2}>Choose the <span className="text-primary">plan</span> that fits your family</Heading>

                <SubHeading>
                  All plans include a 3-day free trial to get started.
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
      <section className="bg-surface-subtle py-16">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <Pill>Support that feels human</Pill>
                <Heading type={2}>Frequently asked questions</Heading>
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

                <div className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    For care teams
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Running an assisted living community or care team? We&apos;ll
                    help you fit check-ins into real schedules and routines.
                  </p>
                  <Button
                    variant="link"
                    href="/contact"
                    className="mt-3 h-auto px-0 text-primary"
                  >
                    Talk to us →
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

                <AccordionItem value="cost">
                  <AccordionTrigger className="hover:bg-transparent">
                    How much does it cost?
                  </AccordionTrigger>
                  <AccordionContent>
                    Plans start at $39/month for one line with 300 minutes included.
                    Additional minutes are $0.15 each. We offer annual plans with
                    15% savings, and usage-based options for larger families.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="customize">
                  <AccordionTrigger className="hover:bg-transparent">
                    Can I customize the call schedule?
                  </AccordionTrigger>
                  <AccordionContent>
                    Absolutely! Set custom call times, quiet hours, and recurring
                    schedules that fit your loved one&apos;s routine. You can pause,
                    skip, or adjust calls anytime through your dashboard.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="relative bg-surface-accent py-16 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <Container>
          <div className="relative flex flex-col items-center text-center space-y-6">
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
