import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Accessibility - Ultaura',
  description:
    'Our commitment to accessibility and how Ultaura supports seniors and caregivers.',
};

const LAST_UPDATED = 'February 5, 2026';

function AccessibilityPage() {
  return (
    <div className="flex flex-col space-y-16 pb-24">
      <div className="bg-primary/10 py-24">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <Heading type={1}>Accessibility Statement</Heading>
            <SubHeading className="max-w-3xl mx-auto">
              Ultaura is built for older adults and caregivers. We design for
              clarity, comfort, and ease of use on any phone.
            </SubHeading>
            <p className="text-sm text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </Container>
      </div>

      <Container>
        <div className="mx-auto max-w-4xl space-y-12">
          <section className="rounded-2xl border border-border/60 bg-sidebar p-6 md:p-8 space-y-4 shadow-xl">
            <Heading type={3}>Plain-English Summary</Heading>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Ultaura works on any phone, including landlines.</li>
              <li>
                We offer voice options, speech rate controls, and hearing or
                cognitive support modes.
              </li>
              <li>
                Caregivers can adjust settings from a clear, accessible
                dashboard.
              </li>
              <li>
                You can contact us at support@ultaura.com with feedback or
                accessibility requests.
              </li>
              <li>
                Accessibility is an ongoing effort and we update the experience
                based on feedback.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              This summary is a quick overview; details are below.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Our Commitment</Heading>
            <p className="text-lg text-muted-foreground">
              We aim to make companionship accessible to seniors and peace of
              mind accessible to families. That means removing barriers to
              communication, prioritizing calm and clarity, and making the
              product understandable at a glance. We use accessibility best
              practices and reference WCAG 2.1 AA guidelines when designing and
              improving features.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Scope of This Statement</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>This statement covers the experiences we provide across:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Outbound and inbound phone calls.</li>
                <li>Caregiver dashboard experiences on desktop and mobile.</li>
                <li>Notifications and email summaries sent by Ultaura.</li>
                <li>Support and feedback channels.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Phone Accessibility</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5">
                <li>Works on landlines, flip phones, and smartphones.</li>
                <li>No smartphone app or data plan required to use Ultaura.</li>
                <li>
                  Multiple voice options with clear pronunciation and natural
                  pacing.
                </li>
                <li>
                  Hearing modes to adjust clarity and pacing for easier
                  listening.
                </li>
                <li>
                  Cognitive support modes to simplify language and repeat
                  important details.
                </li>
                <li>
                  Quiet hours and call schedules that respect routines and
                  caregiver preferences.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Hearing & Cognitive Support</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura includes optional modes that make conversations easier
                to follow and remember.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Hearing mode options include Normal, Enhanced Clarity, and
                  Slow Pace.
                </li>
                <li>
                  Cognitive mode options include Normal, Supportive, and High
                  Support.
                </li>
                <li>
                  Families can enable or disable these modes per line based on
                  the individual&apos;s needs.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Voice & Conversation Settings</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Caregivers can tailor how the voice sounds and how information
                is delivered.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Voice options include Ara (warm), Rex (clear), Sal (relaxed),
                  Eve (bright), and Leo (calm).
                </li>
                <li>
                  Speech rate can be fine-tuned from slower to faster pacing.
                </li>
                <li>
                  Context windows limit how much prior context is referenced in
                  a call.
                </li>
                <li>
                  Reminders can be repeated or clarified during calls if needed.
                </li>
                <li>
                  Quiet hours, vacation pauses, and schedule changes are
                  available to respect daily routines.
                </li>
              </ul>
              <p>
                These settings apply to each line individually. They do not
                change phone volume, which is controlled by the device or
                carrier.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Dashboard Accessibility</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Our dashboard is designed with clear labels, readable text, and
                keyboard navigation in mind. We focus on low-friction setup so
                caregivers can make changes quickly without a learning curve.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Logical page structure with consistent headings.</li>
                <li>Readable typography and spacing for quick scanning.</li>
                <li>Form fields with clear labels and error messaging.</li>
                <li>Mobile-friendly layouts for tablet and phone use.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Feedback Process</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                We welcome feedback on accessibility barriers or improvement
                ideas. Email{' '}
                <a className="underline" href="mailto:support@ultaura.com">
                  support@ultaura.com
                </a>{' '}
                with details such as the device, browser (if using the
                dashboard), and the part of the experience that was difficult.
              </p>
              <p>
                We review every report and prioritize changes that increase
                clarity, reduce confusion, or improve comfort for seniors and
                caregivers.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Ongoing Improvement</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Accessibility is an ongoing effort. We regularly review
                feedback, revisit language choices, and refine call and
                dashboard experiences to keep Ultaura calm, clear, and
                inclusive.
              </p>
              <p>
                If you need help adjusting settings or understanding a feature,
                we&apos;re here to help and can guide you through accessibility
                options step-by-step.
              </p>
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}

export default withI18n(AccessibilityPage);
