import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Terms of Service - Ultaura',
  description:
    'Ultaura terms of service. Clear terms for our AI voice companion, including billing, cancellation, and data handling policies.',
};

const LAST_UPDATED = 'February 5, 2026';

function TermsPage() {
  return (
    <div className="flex flex-col space-y-16 pb-24">
      <div className="bg-primary/10 py-24">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <Heading type={1}>Terms of Service</Heading>
            <SubHeading className="max-w-3xl mx-auto">
              These terms explain how Ultaura works and what to expect when you
              use the service.
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
              <li>
                Ultaura provides AI-powered companion calls, not medical or
                emergency services.
              </li>
              <li>
                You are responsible for getting consent from the people you
                enroll.
              </li>
              <li>
                Subscriptions renew automatically until you cancel. Overages may
                be billed based on your plan.
              </li>
              <li>
                We can suspend service for abuse, fraud, or safety concerns.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              This summary highlights key points; the full terms below control.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Definitions</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Account Owner</strong>: The person or organization who
                  creates and pays for the Ultaura account.
                </li>
                <li>
                  <strong>Line Recipient</strong>: The person who receives calls
                  from Ultaura.
                </li>
                <li>
                  <strong>Trusted Contact</strong>: A person designated to
                  receive wellness alerts when enabled.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>The Service</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura provides scheduled and on-demand phone conversations for
                older adults. It is designed for companionship, reminders, and
                wellness check-ins. Ultaura is not a medical device and not an
                emergency response service.
              </p>
              <p>
                The service includes automated voice calls, scheduling tools,
                reminders, wellness alerts, and an insights dashboard for
                families or caregivers. Calls are powered by AI and may include
                summaries, mood indicators, and safety signals. We continually
                improve the service, which means features may change over time.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Eligibility & Account</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You must be at least 18 years old and capable of entering a
                binding agreement. If you create or pay for an account on
                behalf of someone else, you represent that you have the legal
                authority to do so.
              </p>
              <p>
                You are responsible for all activity under your account, all
                phone numbers you add, and any information provided to us.
                Keep your login credentials secure and notify us promptly of
                any unauthorized access.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Consent & Acceptable Use</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You agree to obtain clear, informed consent from anyone
                receiving calls or messages and from any person whose personal
                data you provide. You also agree to use Ultaura lawfully and
                respectfully.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Only enroll people who have consented to receive Ultaura
                  calls.
                </li>
                <li>
                  Do not use Ultaura to harass, deceive, or exploit anyone.
                </li>
                <li>No use for harassment, fraud, or illegal activity.</li>
                <li>
                  No attempts to reverse engineer, scrape, or misuse the
                  service or its AI models.
                </li>
                <li>
                  No use for emergency response or medical decision-making.
                </li>
                <li>
                  Do not upload or share content that infringes IP rights or
                  violates privacy laws.
                </li>
              </ul>
              <p>
                You are responsible for complying with all applicable laws,
                including call recording, consent, and telephony regulations.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Safety & Emergency Limitations</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                If someone is in immediate danger, call 911. For mental health
                crises in the U.S., call or text 988. Ultaura may provide gentle
                safety guidance, but it does not replace professional care.
              </p>
              <p>
                Ultaura is not guaranteed to detect distress or emergencies. It
                does not provide continuous monitoring, dispatch services, or
                real-time escalation. Any alerts or summaries are informational
                only and may be delayed or incomplete.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>AI Limitations</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura uses AI to generate conversation, summaries, and
                reminders. AI can make mistakes or misunderstand context. You
                should not rely on AI output for medical, legal, or emergency
                decisions.
              </p>
              <p>
                You are responsible for reviewing important information and for
                taking any action needed based on your own judgment.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Subscriptions, Trials & Billing</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Plans renew automatically until you cancel in your account
                  settings.
                </li>
                <li>
                  Most plans include a 14-day free trial. The Free Trial
                  includes up to 20 minutes per day and ends after 14 days.
                </li>
                <li>
                  Minutes are pooled at the account level and allocated across
                  lines based on your plan.
                </li>
                <li>
                  Usage-based overages are billed at the rate shown at
                  checkout, currently $0.15 per minute for paid plans.
                </li>
                <li>
                  The Usage Based plan has no monthly fee and charges per minute
                  as usage occurs.
                </li>
                <li>
                  Taxes, carrier fees, or payment processing fees may apply
                  where required by law.
                </li>
                <li>
                  If you cancel, service continues until the end of the
                  current billing period unless otherwise required by law.
                </li>
              </ul>
              <p>
                All fees are non-refundable except where required by law or
                explicitly stated at checkout. You are responsible for keeping
                billing information current.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Cancellations & Plan Changes</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You can cancel at any time in your account settings. Canceling
                stops future renewals and preserves access through the end of
                the paid period unless otherwise required by law.
              </p>
              <p>
                If you delete lines or reduce plan levels, changes take effect
                on the next billing cycle. We may retain certain records as
                described in the Privacy Policy and required by law.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Service Changes & Availability</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                We may update features, pricing, or availability to improve
                reliability, safety, or compliance. We will provide notice of
                material changes as required by law.
              </p>
              <p>
                Service is currently available for U.S. phone numbers only.
                Delivery of calls depends on carrier networks, device
                settings, call screening tools, and other factors outside our
                control.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Third-Party Services</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura relies on third-party providers for telephony, AI,
                analytics, messaging, and payments. Those providers may have
                their own terms and privacy policies, and your use of Ultaura
                may be subject to them.
              </p>
              <p>
                We are not responsible for outages, delays, or errors caused
                by third-party services or carrier networks. If a provider
                changes its terms or availability, we may need to adjust the
                service accordingly.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Your Content & Feedback</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You own your content. By sending feedback, messages, or other
                materials to Ultaura, you grant us a limited license to use,
                reproduce, and process that content to provide and improve the
                service and to respond to support requests.
              </p>
              <p>
                You are responsible for the content you share and for ensuring
                you have the rights needed to provide it to us.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Intellectual Property</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura, the software, and related content are owned by Ultaura
                or its licensors. You receive a limited, non-exclusive,
                non-transferable license to access and use the service while
                your subscription is active and you comply with these terms.
              </p>
              <p>
                You may not copy, modify, distribute, sell, or create
                derivative works from the service or its AI models unless we
                explicitly allow it in writing.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Privacy</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Your use of Ultaura is also governed by our Privacy Policy,
                which explains how we collect, use, and protect your
                information, including call data, reminders, and wellness
                insights.
              </p>
              <p>
                If you provide personal information about another person, you
                confirm you have the right to share it with us for the purposes
                of providing the service.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Disclaimers</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                We provide the service on an &quot;as is&quot; and &quot;as available&quot;
                basis. We do our best to be reliable, but we don&apos;t guarantee
                uninterrupted service, specific outcomes, or that AI responses
                will always be accurate or appropriate.
              </p>
              <p>
                You are responsible for how you use the service and for
                verifying any information or recommendations provided by the
                AI.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Limitation of Liability</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                To the maximum extent permitted by law, Ultaura is not liable
                for indirect, incidental, special, consequential, or punitive
                damages related to your use of the service.
              </p>
              <p>
                Our total liability for any claim is limited to the amount you
                paid to Ultaura in the three months before the event giving
                rise to the claim, unless a different limit is required by law.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Arbitration Agreement</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Except as noted below, any dispute, claim, or controversy
                arising out of or relating to these terms or the service will
                be resolved by binding individual arbitration under the Federal
                Arbitration Act. Arbitration will be administered by a
                recognized provider and may take place by phone, video, or in
                a location reasonably convenient to you.
              </p>
              <p>
                You may opt out of arbitration by emailing{' '}
                <a className="underline" href="mailto:support@ultaura.com">
                  support@ultaura.com
                </a>{' '}
                within 30 days of first accepting these terms (or within 30
                days of any material update). Your request must include your
                name, the account email, and a clear statement that you want to
                opt out of arbitration.
              </p>
              <p>
                Exceptions: Either party may bring an individual claim in small
                claims court, and either party may seek injunctive or equitable
                relief to protect intellectual property or prevent misuse of
                the service.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Class Action Waiver</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                To the maximum extent permitted by law, you and Ultaura agree
                that disputes will be brought only in an individual capacity
                and not as a plaintiff or class member in any purported class,
                collective, consolidated, or representative action.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Governing Law & Venue</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                These terms are governed by the laws of the State of New
                Jersey, excluding its conflict of law rules. If a dispute is
                not subject to arbitration or you opt out, you and Ultaura
                agree to the exclusive jurisdiction and venue of the state or
                federal courts located in New Jersey.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Termination & Suspension</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You may stop using the service at any time. We may suspend or
                terminate your access if we reasonably believe you violated
                these terms, misused the service, or created risk or harm to
                others.
              </p>
              <p>
                We may also suspend service during investigations of fraud or
                safety concerns, or when required by law or a third-party
                provider. If we terminate your account for cause, you are not
                entitled to refunds.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Changes to These Terms</Heading>
            <p className="text-lg text-muted-foreground">
              We may update these terms as the service evolves. If changes are
              material, we will provide notice on this page or in your
              dashboard.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Contact Us</Heading>
            <p className="text-lg text-muted-foreground">
              Questions about these terms? Email{' '}
              <a className="underline" href="mailto:support@ultaura.com">
                support@ultaura.com
              </a>
              .
            </p>
            <p className="text-lg text-muted-foreground">
              Ultaura, 725 Joralemon St Unit 127, Belleville, NJ 07109.
            </p>
          </section>
        </div>
      </Container>
    </div>
  );
}

export default withI18n(TermsPage);
