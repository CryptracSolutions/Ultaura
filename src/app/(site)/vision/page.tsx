import {
  PhoneIcon,
  HeartIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  SparklesIcon,
  LockClosedIcon,
  HandRaisedIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  AcademicCapIcon,
  EyeIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { GradientText } from '~/app/(site)/components/PageHero';
import { MainCallToActionButton } from '~/app/(site)/components/MainCallToActionButton';
import BlendedDemoFrame from '~/app/(site)/components/BlendedDemoFrame';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Our Vision - Ultaura',
  description:
    'Why we built Ultaura: a voice companion born from experience in elder care, designed with professionals, and built on principles of honesty, privacy, and safety.',
};

const STATS = [
  { value: '1 in 3', label: 'older adults face loneliness', source: 'AARP/National Academies' },
  { value: '15 cigs', label: 'Loneliness mortality risk equivalent', source: 'Holt-Lunstad' },
  { value: '16M', label: 'seniors live alone in the US', source: 'Census Bureau' },
  { value: '$19/mo', label: 'vs $30/hr for home aides', source: 'Care.com/Genworth' },
];

const FEATURES = [
  {
    icon: PhoneIcon,
    title: 'Calls when you choose — not random check-ins',
    description:
      'You set the schedule. Morning encouragement, afternoon chat, evening wind-down. Quiet hours mean no calls during naps or after bedtime. Vacation mode pauses everything with one click.',
  },
  {
    icon: HeartIcon,
    title: 'Conversations that build on each other',
    description:
      "Ultaura remembers their stories, interests, and the names that matter to them. 'How's that garden coming along?' not 'Tell me about yourself' every time.",
  },
  {
    icon: ShieldCheckIcon,
    title: 'Detects distress. Guides to help.',
    description:
      'If we hear signs of crisis, Ultaura can gently suggest calling 988 or 911. You get notified. Not surveillance — just a safety net.',
  },
  {
    icon: ChartBarIcon,
    title: 'Weekly summaries. Mood trends. No transcripts.',
    description:
      "See how they're doing without invading their privacy. We share insights, not recordings. Their conversations stay theirs.",
  },
];

const PRINCIPLES = [
  {
    icon: SparklesIcon,
    title: 'Always Honest About AI',
    description:
      'Ultaura identifies as AI at the start of every call. No voice cloning. No pretending to be a person. Deception has no place in companionship.',
  },
  {
    icon: LockClosedIcon,
    title: 'Privacy by Default',
    description:
      "We don't store transcripts or recordings. Family sees usage and mood trends — never the actual conversation. What they share stays between them and Ultaura.",
  },
  {
    icon: ExclamationTriangleIcon,
    title: 'Safety Over Engagement',
    description:
      "We'd rather a call end early than miss a sign of distress. Crisis protocols are built in, not bolted on. 988 and 911 guidance when it matters.",
  },
  {
    icon: HandRaisedIcon,
    title: 'No Manipulation',
    description:
      'No guilt language. No artificial dependency. We actively encourage real-world connection — calls with family, visits with friends. Ultaura is a supplement, never a replacement.',
  },
];

const IMAGE_FADE =
  'radial-gradient(128% 128% at 50% 46%, #000 62%, rgba(0,0,0,0.92) 72%, transparent 100%)';

const IMAGE_MASK_STYLE: React.CSSProperties = {
  WebkitMaskImage: IMAGE_FADE,
  maskImage: IMAGE_FADE,
};

function VisionPage() {
  return (
    <div className="flex flex-col">
      {/* Hero + Founder Origin */}
      <section className="relative overflow-hidden py-14 md:py-20">
        <div
          aria-hidden="true"
          className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10"
        />

        <Container>
          <div className="relative flex flex-col items-center text-center space-y-5">
            <span className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Our Vision
            </span>

            <Heading
              type={1}
              className="text-4xl md:text-[2.475rem] xl:text-[3.3rem]"
            >
              Why We Built <GradientText>Ultaura</GradientText>
            </Heading>

            <SubHeading className="max-w-2xl">
              A voice companion born from watching too many seniors slip into
              silence — and knowing technology could do better.
            </SubHeading>
          </div>

          <div className="relative mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
            <div>
              <p className="text-sm font-medium text-primary mb-2">
                Joseph Silvagnoli, Founder
              </p>
              <Heading type={2} className="text-2xl md:text-3xl mb-8">
                I Saw It Every Day
              </Heading>
              <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
                <p>
                  Before Ultaura, I worked in elder care. I saw what loneliness
                  does — not dramatically, but quietly. The woman who stopped
                  getting dressed because no one was coming. The man who called
                  the front desk just to hear a voice.
                </p>
                <p>
                  Apps couldn&apos;t help them. Too many buttons, too much
                  frustration. But they all knew how to answer a phone.
                </p>
                <blockquote className="border-l-4 border-primary pl-6 py-2 my-8 text-primary font-medium italic text-xl">
                  &ldquo;Loneliness isn&apos;t cured by technology. It&apos;s
                  cured by presence.&rdquo;
                </blockquote>
                <p>
                  That gap — between what seniors need and what technology
                  offers — is why Ultaura exists. Not to replace family. To fill
                  the silence between visits.
                </p>
              </div>
            </div>

            <div className="mx-auto w-full max-w-sm md:mx-0 md:max-w-none">
              <BlendedDemoFrame>
                <Image
                  src="/illustrations/connection.png"
                  alt="Isometric illustration of a senior in a cozy room by a window, phone to ear, with colorful sound waves filling the space with warmth"
                  width={900}
                  height={900}
                  className="w-full h-auto rounded-[1.35rem] shadow-[0_28px_65px_-40px_rgba(17,24,39,0.75)]"
                  style={IMAGE_MASK_STYLE}
                />
              </BlendedDemoFrame>
            </div>
          </div>
        </Container>
      </section>

      {/* Stats */}
      <section className="py-14 md:py-20">
        <Container>
          <div className="rounded-3xl bg-surface-elevated px-6 py-10 lg:px-12 lg:py-12">
            <div className="flex flex-col items-center text-center space-y-4 mb-10">
              <span className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                The loneliness crisis
              </span>
              <Heading type={2}>
                A Problem We Can&apos;t <GradientText>Ignore</GradientText>
              </Heading>
            </div>

            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border/40">
              {STATS.map((stat) => (
                <div
                  key={stat.value}
                  className="flex flex-col items-center text-center lg:px-8"
                >
                  <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                    {stat.value}
                  </span>
                  <span className="mt-2 text-sm md:text-base font-medium text-foreground">
                    {stat.label}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Source: {stat.source}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Features + Credibility */}
      <section className="bg-surface-subtle py-14 md:py-20">
        <Container>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            <div className="mx-auto w-full max-w-sm md:mx-0 md:max-w-none">
              <BlendedDemoFrame>
                <Image
                  src="/illustrations/collaboration.png"
                  alt="Isometric illustration of diverse care professionals gathered around a round table collaboratively shaping Ultaura"
                  width={900}
                  height={900}
                  className="w-full h-auto rounded-[1.35rem] shadow-[0_28px_65px_-40px_rgba(17,24,39,0.75)]"
                  style={IMAGE_MASK_STYLE}
                />
              </BlendedDemoFrame>
            </div>

            <div>
              <Heading type={2}>
                What Ultaura <GradientText>Actually Does</GradientText>
              </Heading>

              <div className="mt-8 space-y-6">
                {FEATURES.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-4">
                    <div className="shrink-0 rounded-xl border border-primary/10 bg-primary/10 p-3 text-primary">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center text-center space-y-6">
            <Heading type={2} className="text-2xl md:text-3xl">
              Designed by professionals who understand
            </Heading>
            <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Ultaura wasn&apos;t built in isolation. We consulted elder care
              professionals, geriatric nurses, and family caregivers throughout
              development. Their input shaped everything — from how Ultaura
              speaks to what it watches for.
            </p>

            <BlendedDemoFrame>
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border/60 bg-sidebar p-6">
                <CredentialBadge icon={HeartIcon}>
                  Elder care professionals
                </CredentialBadge>
                <CredentialBadge icon={AcademicCapIcon}>
                  Geriatric nurses
                </CredentialBadge>
                <CredentialBadge icon={UserGroupIcon}>
                  Family caregivers
                </CredentialBadge>
                <CredentialBadge icon={EyeIcon}>
                  Accessibility specialists
                </CredentialBadge>
              </div>
            </BlendedDemoFrame>
          </div>
        </Container>
      </section>

      {/* Principles */}
      <section className="py-14 md:py-20">
        <Container>
          <div className="ml-auto max-w-2xl text-right space-y-4">
            <Heading type={2}>
              What We <GradientText>Believe</GradientText>
            </Heading>
            <SubHeading>
              The principles that guide every decision we make.
            </SubHeading>
          </div>

          <div className="mx-auto mt-10 max-w-xl lg:max-w-6xl">
            <ol
              className="relative space-y-6"
              style={{ '--track-x': '1.75rem' } as React.CSSProperties}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[var(--track-x)] top-4 h-[calc(100%-32px)] w-px -translate-x-1/2 bg-primary"
              />
              {PRINCIPLES.map((principle) => (
                <li key={principle.title} className="relative pl-16">
                  <div className="absolute left-[var(--track-x)] top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-background text-primary shadow-sm">
                    <principle.icon className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-sidebar p-6 shadow-xl">
                    <h3 className="font-semibold text-foreground">
                      {principle.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {principle.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="relative bg-surface-accent py-14 md:py-20 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/4 -translate-x-1/2 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
        />
        <Container>
          <div className="relative mx-auto max-w-3xl text-center space-y-6">
            <Heading type={2}>
              Not a <GradientText>Replacement</GradientText>
            </Heading>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Ultaura isn&apos;t a substitute for family, friends, or human
              caregivers. It&apos;s a voice for the times in between — the quiet
              Tuesday afternoons, the early mornings when no one&apos;s awake
              yet, the evenings that stretch too long.
            </p>

            <BlendedDemoFrame>
              <div className="rounded-2xl border border-border/60 bg-sidebar p-8">
                <p className="text-xl md:text-2xl font-medium italic text-foreground">
                  &ldquo;Someone to chat with. Someone who remembers. Someone
                  who&apos;s always glad they called.&rdquo;
                </p>
              </div>
            </BlendedDemoFrame>

            <div className="border-t border-border/40 my-8" />

            <Heading type={3}>
              Give the Gift of <GradientText>Conversation</GradientText>
            </Heading>

            <p className="text-lg text-muted-foreground">
              Set up in 5 minutes. Cancel anytime. Their first call can happen
              today.
            </p>

            <MainCallToActionButton />

            <div className="flex flex-wrap gap-3 justify-center text-sm text-muted-foreground">
              {['Works on any phone', 'No app required', 'Cancel anytime'].map(
                (item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1"
                  >
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

interface CredentialBadgeProps {
  icon: React.ElementType;
  children: React.ReactNode;
}

function CredentialBadge({ icon: Icon, children }: CredentialBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </span>
  );
}

export default withI18n(VisionPage);
