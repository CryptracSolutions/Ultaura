import {
  UserGroupIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  HandRaisedIcon,
  LockClosedIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import { withI18n } from '~/i18n/with-i18n';
import Button from '~/core/ui/Button';

export const metadata = {
  title: 'About - Ultaura',
  description:
    'Learn about Ultaura, the AI voice companion designed to provide friendly phone conversations for seniors.',
};

function AboutPage() {
  return (
    <div className="flex flex-col space-y-24 pb-24">
      {/* Hero */}
      <div className="bg-muted/30 py-24">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <Heading type={1}>About Ultaura</Heading>
            <SubHeading className="max-w-2xl mx-auto">
              We created Ultaura to address a simple but profound problem:
              loneliness among seniors.
            </SubHeading>
          </div>
        </Container>
      </div>

      <Container>
        <div className="space-y-24">
          {/* The Problem */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 space-y-6">
              <Heading type={2}>The Problem</Heading>
              <div className="space-y-4 text-muted-foreground text-lg">
                <p>
                  Millions of seniors live alone. Many face language barriers,
                  mobility challenges, or simply don&apos;t have family nearby.
                </p>
                <p>
                  App-based solutions fail them — too complicated, too
                  unfamiliar. But everyone knows how to use a phone.
                </p>
              </div>
            </div>
            <div className="order-1 md:order-2 flex justify-center">
              <div className="bg-destructive/10 p-12 rounded-full">
                <UserGroupIcon className="w-32 h-32 text-destructive/80" />
              </div>
            </div>
          </div>

          {/* Our Solution */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center">
              <div className="bg-primary/10 p-12 rounded-full">
                <LightBulbIcon className="w-32 h-32 text-primary" />
              </div>
            </div>
            <div className="space-y-6">
              <Heading type={2}>Our Solution</Heading>
              <div className="space-y-4 text-muted-foreground text-lg">
                <p>
                  Ultaura is an AI voice companion that works on any phone —
                  landlines included. Your loved one can call anytime for
                  friendly conversation, or Ultaura can call them on a schedule
                  you set.
                </p>
                <p>
                  We remember their stories, their interests, and the things
                  that matter to them. Every call builds on the last, creating
                  genuine continuity and connection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Principles */}
      <div className="bg-muted/30 py-24">
        <Container>
          <div className="space-y-12">
            <div className="text-center">
              <Heading type={2}>Our Principles</Heading>
              <SubHeading>Built with care and respect</SubHeading>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <PrincipleCard
                icon={LockClosedIcon}
                title="Privacy by Default"
                description="We don't store transcripts. Families see usage, not conversations. What happens in a call stays private."
              />
              <PrincipleCard
                icon={SparklesIcon}
                title="Honest About AI"
                description="Ultaura always discloses it's an AI at the start of every conversation. No deception, ever."
              />
              <PrincipleCard
                icon={ShieldCheckIcon}
                title="Safety-Conscious"
                description="We have protocols for distress, with gentle guidance to 988 and 911 when needed. Safety comes first."
              />
              <PrincipleCard
                icon={HandRaisedIcon}
                title="No Manipulation"
                description="We never use guilt language or create artificial dependency. We encourage real-world connection."
              />
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="max-w-4xl mx-auto space-y-24">
          {/* Not a Replacement */}
          <div className="p-8 md:p-12 rounded-2xl bg-primary/5 border border-primary/10 text-center space-y-6">
            <Heading type={3}>Not a Replacement</Heading>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ultaura isn&apos;t a replacement for human connection — it&apos;s
              a supplement. A friendly voice for the times in between. Someone
              to chat with when family can&apos;t be there. A companion who&apos;s
              always happy to listen.
            </p>
          </div>

          {/* Our Story */}
          <div className="text-center space-y-6">
            <Heading type={2}>Our Story</Heading>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Founded by a team of engineers and caregivers who saw the need for
              better technology for seniors. We believe that technology should
              adapt to people, not the other way around.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center space-y-8">
            <Heading type={2}>
              Ready to give the gift of companionship?
            </Heading>
            <p className="text-muted-foreground">
              Start with 20 free minutes. No credit card required.
            </p>
            <Button size="lg" href="/auth/sign-up">
              Start Free Trial
            </Button>
          </div>
        </div>
      </Container>
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
    <div className="p-6 rounded-xl bg-background border border-border shadow-sm flex flex-col items-center text-center space-y-4">
      <div className="p-3 bg-primary/10 rounded-full text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-foreground text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default withI18n(AboutPage);
