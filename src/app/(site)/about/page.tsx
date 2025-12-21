import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'About - Ultaura',
  description: 'Learn about Ultaura, the AI voice companion designed to provide friendly phone conversations for seniors.',
};

function AboutPage() {
  return (
    <div>
      <Container>
        <div className={'flex flex-col space-y-14 my-8'}>
          <div className={'flex flex-col items-center space-y-4'}>
            <Heading type={1}>About Ultaura</Heading>

            <SubHeading className="text-center max-w-2xl">
              We created Ultaura to address a simple but profound problem: loneliness among seniors.
            </SubHeading>
          </div>

          <div
            className={
              'm-auto flex w-full max-w-2xl flex-col space-y-12'
            }
          >
            {/* The Problem */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">The Problem</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Millions of seniors live alone. Many face language barriers, mobility challenges,
                  or simply don&apos;t have family nearby. App-based solutions fail them — too complicated,
                  too unfamiliar.
                </p>
                <p className="font-medium text-foreground">
                  But everyone knows how to use a phone.
                </p>
              </div>
            </section>

            {/* Our Solution */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Our Solution</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Ultaura is an AI voice companion that works on any phone — landlines included.
                  Your loved one can call anytime for friendly conversation, or Ultaura can call
                  them on a schedule you set.
                </p>
                <p>
                  We remember their stories, their interests, and the things that matter to them.
                  Every call builds on the last, creating genuine continuity and connection.
                </p>
              </div>
            </section>

            {/* Our Principles */}
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Our Principles</h2>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Privacy by Default</h3>
                  <p className="text-sm text-muted-foreground">
                    We don&apos;t store transcripts. Families see usage, not conversations.
                    What happens in a call stays private.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Honest About AI</h3>
                  <p className="text-sm text-muted-foreground">
                    Ultaura always discloses it&apos;s an AI at the start of every conversation.
                    No deception, ever.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Safety-Conscious</h3>
                  <p className="text-sm text-muted-foreground">
                    We have protocols for distress, with gentle guidance to 988 and 911 when needed.
                    Safety comes first.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="font-semibold text-foreground mb-2">No Manipulation</h3>
                  <p className="text-sm text-muted-foreground">
                    We never use guilt language or create artificial dependency.
                    We encourage real-world connection.
                  </p>
                </div>
              </div>
            </section>

            {/* Not a Replacement */}
            <section className="space-y-4 p-8 rounded-xl bg-primary/5 border border-primary/10">
              <h2 className="text-xl font-semibold text-foreground">Not a Replacement</h2>
              <p className="text-muted-foreground">
                Ultaura isn&apos;t a replacement for human connection — it&apos;s a supplement.
                A friendly voice for the times in between. Someone to chat with when family
                can&apos;t be there. A companion who&apos;s always happy to listen.
              </p>
            </section>

            {/* CTA */}
            <section className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-semibold text-foreground">
                Ready to give the gift of companionship?
              </h2>
              <p className="text-muted-foreground">
                Start with 20 free minutes. No credit card required.
              </p>
              <a
                href="/auth/sign-up"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Start Free Trial
              </a>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default withI18n(AboutPage);
