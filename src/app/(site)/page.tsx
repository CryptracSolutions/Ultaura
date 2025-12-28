import {
  PhoneIcon,
  HeartIcon,
  ShieldCheckIcon,
  EyeIcon,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';

const HERO_TESTIMONIALS = [
  {
    content:
      "Ultaura has been a lifesaver. My mom loves the daily calls, and I feel better knowing she's chatting with someone who remembers her stories and asks about them.",
    author: 'Sarah M.',
    role: 'Daughter',
  },
  {
    content:
      'I was skeptical at first, but the conversations are surprisingly natural. It helps my dad with the loneliness between visits.',
    author: 'James P.',
    role: 'Son',
  },
];

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
                  Warm, natural phone calls to your parent — no app required.
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
                20 free minutes • no credit card • cancel anytime
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
                  Works on landlines
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

                  <div className="flex w-full items-center justify-start gap-4 rounded-2xl bg-muted/40 p-4 text-left">
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
                    {['Warm', 'Clear', 'Gentle', 'Bright'].map((chip) => (
                      <span
                        key={chip}
                        className={
                          'rounded-full border border-border bg-background px-3 py-1' +
                          (chip === 'Warm'
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

          <div className="mt-12 space-y-10">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/90 p-6 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  What you&apos;ll see
                </div>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                    <span>Call summary</span>
                    <span className="font-semibold text-foreground">
                      18 min • calm mood
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                    <span>Recent activity</span>
                    <span className="font-semibold text-foreground">
                      Tue 6:30 PM · Sun 5:00 PM
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/90 p-6 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  What we won&apos;t do
                </div>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    No manipulation or deception.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Never pretend to be human.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    No upsells or pressure tactics.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  For families
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Set up in minutes for your parent or grandparent.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    See call cadence and comfort signals at a glance.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  For care teams
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Designed for multi-resident routines and shift changes.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Scheduling windows and quiet hours built in.
                  </div>
                </div>
                <Button
                  variant="link"
                  href="/contact"
                  className="mt-4 h-auto px-0 text-primary"
                >
                  For care teams →
                </Button>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  For seniors
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Just answer the call — nothing to install.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Respectful conversations that honor independence.
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Loved by families
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {HERO_TESTIMONIALS.map((testimonial) => (
                  <div
                    key={testimonial.author}
                    className="rounded-2xl border border-border/60 bg-background/90 p-6 shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="text-primary/80 text-xs">★★★★★</div>
                      <p className="text-sm text-muted-foreground">
                        &ldquo;{testimonial.content}&rdquo;
                      </p>
                    </div>
                    <div className="mt-4 text-sm">
                      <div className="font-semibold text-foreground">
                        {testimonial.author}
                      </div>
                      <div className="text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Value Props */}
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface-elevated px-6 py-16 lg:px-12">
          <div className="relative">
            <div className="mx-auto flex max-w-3xl flex-col items-center space-y-4 text-center">
              <Pill>Designed for seniors and their families</Pill>
              <Heading type={2}>Why families choose Ultaura</Heading>
              <SubHeading as={'h3'}>
                Simple, safe, and meaningful conversations with zero tech
                friction.
              </SubHeading>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="group flex flex-col items-center rounded-2xl border border-border/60 bg-background/90 p-6 text-center shadow-sm">
                <FeatureIcon>
                  <PhoneIcon className={'h-5 w-5'} />
                </FeatureIcon>
                <h4 className="mt-4 text-lg font-semibold">Works on any phone</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Landlines, cell phones, and flip phones. They just pick up and
                  talk.
                </p>
              </div>

              <div className="group flex flex-col items-center rounded-2xl border border-border/60 bg-background/90 p-6 text-center shadow-sm">
                <FeatureIcon>
                  <HeartIcon className={'h-5 w-5'} />
                </FeatureIcon>
                <h4 className="mt-4 text-lg font-semibold">
                  Remembers their stories
                </h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Continuity across calls so conversations feel personal and
                  familiar.
                </p>
              </div>

              <div className="group flex flex-col items-center rounded-2xl border border-border/60 bg-background/90 p-6 text-center shadow-sm">
                <FeatureIcon>
                  <EyeIcon className={'h-5 w-5'} />
                </FeatureIcon>
                <h4 className="mt-4 text-lg font-semibold">You stay informed</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Dashboard summaries show call activity and duration without
                  exposing transcripts.
                </p>
              </div>

              <div className="group flex flex-col items-center rounded-2xl border border-border/60 bg-background/90 p-6 text-center shadow-sm">
                <FeatureIcon>
                  <ShieldCheckIcon className={'h-5 w-5'} />
                </FeatureIcon>
                <h4 className="mt-4 text-lg font-semibold">Safe & respectful</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Built-in crisis protocols, no manipulation, and clear AI
                  disclosure every time.
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-border/60 bg-background/90 p-6 shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Caregiver peace of mind
              </div>
              <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Works on any phone, no app needed.
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    You see activity and duration, never transcripts.
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Built-in safety protocols and transparency.
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:-mt-2">
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">Setup</div>
                    <div className="text-lg font-semibold text-foreground">
                      Less than 5 minutes
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">Coverage</div>
                    <div className="text-lg font-semibold text-foreground">
                      Mobile and Landline
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>

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
                  All plans include a free trial to get started.
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
      <section className="relative bg-surface-accent py-16 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <Container>
          <div className="relative flex flex-col items-center text-center space-y-6">
            <Heading type={2}>Give the gift of conversation</Heading>
            <SubHeading className="max-w-xl">
              Start your free trial today and give your loved one a companion
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

function FeatureIcon(props: React.PropsWithChildren) {
  return (
    <div className={'flex'}>
      <div
        className={
          'rounded-xl bg-primary/10 p-4 border border-primary/10' +
          ' hover:bg-primary hover:border-primary transition-colors duration-200'
        }
      >
        {props.children}
      </div>
    </div>
  );
}

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
