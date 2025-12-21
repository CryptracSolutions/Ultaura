import {
  PhoneIcon,
  HeartIcon,
  ShieldCheckIcon,
  EyeIcon,
  ClockIcon,
  UserPlusIcon,
  CalendarIcon,
  ChartBarIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Divider from '~/core/ui/Divider';
import Heading from '~/core/ui/Heading';
import { UltauraPricingTable } from '~/components/ultaura/PricingTable';
import { withI18n } from '~/i18n/with-i18n';

function Home() {
  return (
    <div className={'flex flex-col space-y-16'}>
      {/* Hero Section */}
      <Container>
        <div
          className={
            'my-12 flex flex-col items-center md:flex-row lg:my-16' +
            ' mx-auto flex-1 justify-center animate-in fade-in ' +
            ' duration-1000 slide-in-from-top-12'
          }
        >
          <div className={'flex w-full flex-1 flex-col items-center space-y-8'}>
            <Pill>
              <span>AI-powered companionship for your loved ones</span>
            </Pill>

            <HeroTitle>
              <span>Phone companionship for</span>
              <span
                className={
                  'bg-gradient-to-br bg-clip-text text-transparent' +
                  ' from-primary to-primary/70 leading-[1.2]'
                }
              >
                your loved ones
              </span>
            </HeroTitle>

            <SubHeading className={'text-center max-w-2xl'}>
              <span>Ultaura is an AI voice companion that calls your parents</span>
              <span>and grandparents for friendly conversation —</span>
              <span>no app required.</span>
            </SubHeading>

            <div className={'flex flex-col items-center space-y-4'}>
              <MainCallToActionButton />

              <span className={'text-xs text-muted-foreground'}>
                Free trial included. No credit card required.
              </span>
            </div>
          </div>
        </div>
      </Container>

      {/* Value Props */}
      <Container>
        <div
          className={
            'flex flex-col items-center justify-center space-y-24 py-16'
          }
        >
          <div
            className={
              'flex max-w-3xl flex-col items-center space-y-8 text-center'
            }
          >
            <Pill>Designed for seniors and their families</Pill>

            <div className={'flex flex-col space-y-2.5'}>
              <Heading type={2}>Why families choose Ultaura</Heading>

              <SubHeading as={'h3'}>
                Simple, safe, and meaningful conversations
              </SubHeading>
            </div>
          </div>

          <div>
            <div className={'grid gap-12 lg:grid-cols-4'}>
              <div className={'flex flex-col space-y-3'}>
                <FeatureIcon>
                  <PhoneIcon className={'h-5 w-5'} />
                </FeatureIcon>

                <h4 className={'text-lg font-semibold'}>Works on any phone</h4>

                <div className={'text-muted-foreground text-sm'}>
                  Landlines, cell phones, no smartphone needed. Your loved one just picks up the phone.
                </div>
              </div>

              <div className={'flex flex-col space-y-3'}>
                <FeatureIcon>
                  <HeartIcon className={'h-5 w-5'} />
                </FeatureIcon>

                <h4 className={'text-lg font-semibold'}>Remembers their stories</h4>

                <div className={'text-muted-foreground text-sm'}>
                  Ultaura maintains continuity across conversations, remembering names, interests, and past discussions.
                </div>
              </div>

              <div className={'flex flex-col space-y-3'}>
                <FeatureIcon>
                  <EyeIcon className={'h-5 w-5'} />
                </FeatureIcon>

                <h4 className={'text-lg font-semibold'}>You stay informed</h4>

                <div className={'text-muted-foreground text-sm'}>
                  See call activity and duration in your dashboard — without reading transcripts. Their privacy is protected.
                </div>
              </div>

              <div className={'flex flex-col space-y-3'}>
                <FeatureIcon>
                  <ShieldCheckIcon className={'h-5 w-5'} />
                </FeatureIcon>

                <h4 className={'text-lg font-semibold'}>Safe & respectful</h4>

                <div className={'text-muted-foreground text-sm'}>
                  Built-in crisis protocols, no manipulation, and Ultaura always discloses it&apos;s an AI.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* How It Works */}
      <div className="bg-muted/50 py-16">
        <Container>
          <div className="flex flex-col items-center space-y-12">
            <div className="text-center space-y-4">
              <Heading type={2}>How it works</Heading>
              <SubHeading>Get started in minutes</SubHeading>
            </div>

            <div className="grid gap-8 md:grid-cols-4 max-w-5xl">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
                  1
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <UserPlusIcon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold">Sign up & add a line</h4>
                <p className="text-sm text-muted-foreground">
                  Create your account and add your loved one&apos;s phone number
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
                  2
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <CalendarIcon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold">Schedule calls</h4>
                <p className="text-sm text-muted-foreground">
                  Set up when Ultaura calls, or they can call anytime
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
                  3
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <PhoneIcon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold">Natural conversations</h4>
                <p className="text-sm text-muted-foreground">
                  Ultaura chats about their day, interests, memories, and more
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
                  4
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <ChartBarIcon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold">Stay in the loop</h4>
                <p className="text-sm text-muted-foreground">
                  See usage and activity in your dashboard
                </p>
              </div>
            </div>
          </div>
        </Container>
      </div>

      <Divider />

      {/* Pricing Section */}
      <Container>
        <div
          className={
            'flex flex-col items-center justify-center py-16 space-y-16'
          }
        >
          <div className={'flex flex-col items-center space-y-8 text-center'}>
            <Pill>
              Simple, transparent pricing
            </Pill>

            <div className={'flex flex-col space-y-2.5'}>
              <Heading type={2}>
                Choose the plan that fits your family
              </Heading>

              <SubHeading>
                All plans include a free trial to get started.
              </SubHeading>
            </div>
          </div>

          <div className={'w-full'}>
            <UltauraPricingTable />
          </div>
        </div>
      </Container>

      <Divider />

      {/* FAQ Section */}
      <Container>
        <div className="py-16">
          <div className="text-center mb-12 space-y-4">
            <Heading type={2}>Frequently asked questions</Heading>
            <SubHeading>Everything you need to know</SubHeading>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <FAQItem
              question="What is a line?"
              answer="A line is a verified phone number for one person. Each line represents one loved one who will receive calls from Ultaura."
            />
            <FAQItem
              question="Can they call anytime?"
              answer="Yes! Your loved one can call Ultaura 24/7 for inbound calls. Scheduled outbound calls respect quiet hours that you configure."
            />
            <FAQItem
              question="Is it a real person?"
              answer="No, Ultaura is an AI voice companion. We always disclose this at the start of each conversation. Ultaura is designed to provide friendly, natural conversation — not to deceive."
            />
            <FAQItem
              question="What about emergencies?"
              answer="If Ultaura detects distress or concerning language, it gently encourages contacting 988 (mental health crisis line) or 911 for emergencies. Ultaura is not a replacement for emergency services."
            />
            <FAQItem
              question="Do you store conversations?"
              answer="No transcripts are stored by default. We only keep basic call information (time, duration) visible in your dashboard. Your loved one's privacy is paramount."
            />
            <FAQItem
              question="Does it work with landlines?"
              answer="Yes! Ultaura works with any phone — landlines, cell phones, even flip phones. No smartphone or app is needed."
            />
          </div>
        </div>
      </Container>

      {/* Final CTA */}
      <div className="bg-primary/5 py-16">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <Heading type={2}>Give the gift of conversation</Heading>
            <SubHeading className="max-w-xl">
              Start your free trial today and give your loved one a companion who&apos;s always there to listen.
            </SubHeading>
            <MainCallToActionButton />
          </div>
        </Container>
      </div>
    </div>
  );
}

export default withI18n(Home);

function HeroTitle({ children }: React.PropsWithChildren) {
  return (
    <h1
      className={
        'text-center text-4xl text-foreground md:text-5xl' +
        ' flex flex-col font-heading font-medium xl:text-7xl 2xl:text-[5.2rem]'
      }
    >
      {children}
    </h1>
  );
}

function FeatureIcon(props: React.PropsWithChildren) {
  return (
    <div className={'flex'}>
      <div
        className={
          'rounded-xl bg-primary/10 p-4 border' +
          ' border-primary/10'
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
        'inline-flex w-auto items-center space-x-2' +
        ' rounded-full bg-primary/10 px-4 py-2 text-center text-sm' +
        ' font-medium text-primary'
      }
    >
      <span>{props.children}</span>
    </h2>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border border-border rounded-xl p-6 bg-card">
      <h4 className="font-semibold text-foreground mb-2">{question}</h4>
      <p className="text-muted-foreground text-sm">{answer}</p>
    </div>
  );
}

function MainCallToActionButton() {
  return (
    <Button
      className={
        'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg' +
        ' hover:shadow-primary/30'
      }
      variant={'custom'}
      size={'lg'}
      round
      href={'/auth/sign-up'}
    >
      <span className={'flex items-center space-x-2'}>
        <span>Start Free Trial</span>
        <ChevronRightIcon
          className={
            'h-4 animate-in fade-in slide-in-from-left-8' +
            ' delay-1000 fill-mode-both duration-1000 zoom-in'
          }
        />
      </span>
    </Button>
  );
}
