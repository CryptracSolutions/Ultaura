import {
  PhoneIcon,
  HeartIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  SparklesIcon,
  LockClosedIcon,
  HandRaisedIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import { withI18n } from '~/i18n/with-i18n';
import { PageHero, GradientText } from '~/app/(site)/components/PageHero';

export const metadata = {
  title: 'Our Vision - Ultaura',
  description:
    'Why we built Ultaura: a voice companion born from experience in elder care, designed with professionals, and built on principles of honesty, privacy, and safety.',
};

function VisionPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <PageHero
        badge="OUR VISION"
        title={
          <>
            Why We Built <GradientText>Ultaura</GradientText>
          </>
        }
        subtitle="A voice companion born from watching too many seniors slip into silence — and knowing technology could do better."
      />

      {/* Wave Divider */}
      <img
        src="/illustrations/wave-divider.svg"
        alt=""
        aria-hidden="true"
        className="w-full h-auto -mb-1"
      />

      {/* Stats Section */}
      <section className="bg-muted/30 py-16 md:py-20">
        <Container>
          <div className="max-w-5xl mx-auto">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                stat="1 in 3"
                context="older adults face loneliness"
                source="AARP/National Academies"
              />
              <StatCard
                stat="15 cigarettes"
                context="Loneliness mortality risk equivalent"
                source="Holt-Lunstad"
              />
              <StatCard
                stat="16 million"
                context="seniors live alone in the US"
                source="Census Bureau"
              />
              <StatCard
                stat="$39/mo"
                context="vs $30/hr for home aides"
                source="Care.com/Genworth"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Wave Divider */}
      <img
        src="/illustrations/wave-divider.svg"
        alt=""
        aria-hidden="true"
        className="w-full h-auto rotate-180 -mt-1"
      />

      {/* Founder Story */}
      <section className="py-16 md:py-20">
        <Container>
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-center">
              <div>
                <p className="text-sm font-medium text-primary mb-2">Joseph Silvagnoli, Founder</p>
                <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-8">
                  I Saw It Every Day
                </h2>
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
                    &ldquo;Loneliness isn&apos;t cured by technology. It&apos;s cured by presence.&rdquo;
                  </blockquote>
                  <p>
                    That gap — between what seniors need and what technology
                    offers — is why Ultaura exists. Not to replace family. To fill
                    the silence between visits.
                  </p>
                </div>
              </div>
              <div className="mx-auto w-full max-w-sm md:mx-0 md:max-w-none">
                <VisionIllustration
                  src="/illustrations/connection.svg"
                  alt="Isometric illustration of a senior in a cozy room by a window, phone to ear, with colorful sound waves filling the space with warmth"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* What We Actually Deliver */}
      <section className="bg-muted/30 py-16 md:py-20">
        <Container>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Heading type={2}>What Ultaura Actually Does</Heading>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <FeatureCard
                icon={PhoneIcon}
                title="Calls when you choose — not random check-ins"
                description="You set the schedule. Morning encouragement, afternoon chat, evening wind-down. Quiet hours mean no calls during naps or after bedtime. Vacation mode pauses everything with one click."
              />
              <FeatureCard
                icon={HeartIcon}
                title="Conversations that build on each other"
                description="Ultaura remembers their stories, interests, and the names that matter to them. 'How's that garden coming along?' not 'Tell me about yourself' every time."
              />
              <FeatureCard
                icon={ShieldCheckIcon}
                title="Detects distress. Guides to help."
                description="If we hear signs of crisis, Ultaura can gently suggest calling 988 or 911. You get notified. Not surveillance — just a safety net."
              />
              <FeatureCard
                icon={ChartBarIcon}
                title="Weekly summaries. Mood trends. No transcripts."
                description="See how they're doing without invading their privacy. We share insights, not recordings. Their conversations stay theirs."
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Principles */}
      <section className="py-16 md:py-20">
        <Container>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Heading type={2}>What We Believe</Heading>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <PrincipleCard
                icon={SparklesIcon}
                title="Always Honest About AI"
                description="Ultaura identifies as AI at the start of every call. No voice cloning. No pretending to be a person. Deception has no place in companionship."
              />
              <PrincipleCard
                icon={LockClosedIcon}
                title="Privacy by Default"
                description="We don't store transcripts or recordings. Family sees usage and mood trends — never the actual conversation. What they share stays between them and Ultaura."
              />
              <PrincipleCard
                icon={ExclamationTriangleIcon}
                title="Safety Over Engagement"
                description="We'd rather a call end early than miss a sign of distress. Crisis protocols are built in, not bolted on. 988 and 911 guidance when it matters."
              />
              <PrincipleCard
                icon={HandRaisedIcon}
                title="No Manipulation"
                description="No guilt language. No artificial dependency. We actively encourage real-world connection — calls with family, visits with friends. Ultaura is a supplement, never a replacement."
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Built With Care */}
      <section className="bg-muted/30 py-16 md:py-20">
        <Container>
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-[340px_1fr] gap-8 lg:gap-12 items-center">
              <div className="mx-auto w-full max-w-sm md:mx-0 md:max-w-none">
                <VisionIllustration
                  src="/illustrations/collaboration.svg"
                  alt="Isometric illustration of diverse care professionals gathered around a round table collaboratively shaping Ultaura"
                />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-8">
                  Designed by professionals who understand
                </h2>
                <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
                  <p>
                    Ultaura wasn&apos;t built in isolation. We consulted elder care
                    professionals, geriatric nurses, and family caregivers
                    throughout development. Their input shaped everything — from how
                    Ultaura speaks (slower, clearer, patient) to what it watches for
                    (confusion, distress, sudden changes).
                  </p>
                  <p>
                    We also listened to seniors themselves. What makes a
                    conversation feel good? What feels patronizing? What would make
                    them actually want to answer the phone?
                  </p>
                  <p>
                    The result is a companion that adapts to hearing needs, respects
                    cognitive differences, and never rushes.
                  </p>
                </div>

                <div className="mt-10 flex flex-wrap gap-3">
                  <CredentialBadge>Elder care professionals</CredentialBadge>
                  <CredentialBadge>Geriatric nurses</CredentialBadge>
                  <CredentialBadge>Family caregivers</CredentialBadge>
                  <CredentialBadge>Accessibility specialists</CredentialBadge>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Not a Replacement */}
      <section className="py-12 md:py-16">
        <div className="bg-primary/5 border-y border-primary/10">
          <Container>
            <div className="max-w-4xl mx-auto py-10 md:py-14 text-center space-y-5">
              <Heading type={3}>Not a Replacement</Heading>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Ultaura isn&apos;t a substitute for family, friends, or human
                caregivers. It&apos;s a voice for the times in between — the
                quiet Tuesday afternoons, the early mornings when no one&apos;s
                awake yet, the evenings that stretch too long.
              </p>
              <p className="text-lg text-foreground font-medium">
                Someone to chat with. Someone who remembers. Someone who&apos;s
                always glad they called.
              </p>
            </div>
          </Container>
        </div>
      </section>

      {/* CTA */}
      <section className="relative bg-gradient-to-t from-primary/5 to-transparent py-16 md:py-20 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <Container>
          <div className="relative max-w-2xl mx-auto text-center space-y-6">
            <Heading type={2}>Give the Gift of Conversation</Heading>
            <p className="text-lg text-muted-foreground">
              Set up in 5 minutes. No credit card required. Their first call can
              happen today.
            </p>
            <Button size="lg" round href="/auth/sign-up">
              Start 3-day free trial
            </Button>
            <p className="text-sm text-muted-foreground">
              Works on any phone, including landlines · Cancel anytime
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}

function VisionIllustration({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const edgeFade =
    'radial-gradient(128% 128% at 50% 46%, #000 62%, rgba(0,0,0,0.92) 72%, transparent 100%)';
  const edgeMaskStyle: React.CSSProperties = {
    WebkitMaskImage: edgeFade,
    maskImage: edgeFade,
  };

  return (
    <figure className="relative isolate w-full">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(10,186,181,0.18)_0%,rgba(10,186,181,0.08)_38%,rgba(10,186,181,0)_72%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-[1.7rem] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_62%)]"
      />
      <div className="relative rounded-[1.7rem] bg-gradient-to-br from-background/70 via-background/35 to-transparent p-2.5 ring-1 ring-primary/15 shadow-[0_20px_45px_-30px_rgba(10,186,181,0.55)]">
        <Image
          src={src}
          alt={alt}
          width={400}
          height={400}
          className="w-full h-auto rounded-[1.35rem] shadow-[0_28px_65px_-40px_rgba(17,24,39,0.75)]"
          style={edgeMaskStyle}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-[1.8rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-30px_35px_rgba(15,23,42,0.12)]"
      />
    </figure>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-sidebar border border-border/60 shadow-sm space-y-4">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function PrincipleCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="p-5 rounded-xl bg-sidebar border border-border/60 shadow-sm flex flex-col items-center text-center space-y-3">
      <div className="p-2.5 bg-primary/10 rounded-full text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function CredentialBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
      {children}
    </span>
  );
}

function StatCard({
  stat,
  context,
  source,
}: {
  stat: string;
  context: string;
  source: string;
}) {
  return (
    <div className="text-center space-y-2">
      <div className="text-3xl md:text-4xl font-bold text-primary">{stat}</div>
      <div className="text-sm md:text-base text-foreground">{context}</div>
      <div className="text-xs text-muted-foreground">Source: {source}</div>
    </div>
  );
}

export default withI18n(VisionPage);
