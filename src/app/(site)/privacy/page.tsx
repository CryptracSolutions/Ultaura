import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Privacy Policy - Ultaura',
  description:
    "How Ultaura protects your family's data. AES-256 encryption, no recordings stored, HIPAA-compliant practices. Full privacy policy.",
};

const LAST_UPDATED = 'February 5, 2026';

function PrivacyPage() {
  return (
    <div className="flex flex-col space-y-16 pb-24">
      <div className="bg-primary/10 py-24">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <Heading type={1}>Privacy Policy</Heading>
            <SubHeading className="max-w-3xl mx-auto">
              Privacy is central to Ultaura. This policy explains what we
              collect, how we use it, and the controls you have.
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
                We store only what we need to provide companionship, scheduling,
                and safety features.
              </li>
              <li>
                By default, we do not store full call transcripts. We keep call
                metadata and encrypted memory notes for continuity.
              </li>
              <li>
                Recordings are optional and require explicit consent from the
                person receiving calls. Consent can be revoked at any time.
              </li>
              <li>
                Sharing tiers and topic exclusions control what families and
                trusted contacts see.
              </li>
              <li>
                Safety alerts may be sent to trusted contacts when enabled, and
                are redacted to the minimum needed to act.
              </li>
              <li>
                You choose retention periods (30, 90, 365 days, or indefinite)
                and can export or delete data in the Privacy Center.
              </li>
              <li>
                Sensitive data is encrypted, access is restricted, and we do
                not sell personal information.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              This summary highlights key points; the full policy below is the
              controlling version.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Scope</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                This policy applies to Ultaura&apos;s website, dashboard, and voice
                companion service. It covers data collected from account owners
                (payers), line recipients (the person receiving calls), and
                trusted contacts.
              </p>
              <p>
                Account owners manage the service. Line recipients control
                consent, sharing, and privacy preferences for their calls.
                Trusted contacts only see the information shared with them.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>How Ultaura Works With Your Data</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura places scheduled check-in calls using telephony
                providers and connects the call to our AI voice companion.
                Audio is processed in real time so the conversation can happen.
              </p>
              <p>
                After a call, we store call metadata and optional encrypted
                memory notes (summaries, preferences, and reminders) to support
                continuity. We do not keep full call transcripts by default.
              </p>
              <p>
                Safety monitoring may flag concerning content. When enabled, it
                can trigger wellness alerts to trusted contacts with the
                minimal details needed to act.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>What We Collect</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                We collect only the information we need to provide and improve
                the service.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Account details such as name, email, billing information, and
                  subscription plan.
                </li>
                <li>
                  Line information like verified phone numbers, schedules,
                  reminder settings, accessibility preferences, and consent
                  choices.
                </li>
                <li>
                  Call metadata (date/time, duration, outcome, voicemail
                  detection, and delivery status) for usage dashboards,
                  reliability, and billing.
                </li>
                <li>
                  Encrypted memory notes and insights (summaries, preferences,
                  and highlights) to provide continuity.
                </li>
                <li>
                  Safety events and wellness alerts when concerns are detected.
                </li>
                <li>
                  Optional call recordings when recording is enabled and consent
                  is granted.
                </li>
                <li>
                  Support communications, including emails or messages sent to
                  our support team.
                </li>
                <li>
                  Basic product analytics and device information to keep the
                  service reliable and accessible.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>What We Don&apos;t Collect by Default</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                We do not store full call transcripts by default, and we do not
                sell personal data. We aim to capture only the minimum needed to
                provide companionship and safety features.
              </p>
              <p>
                We avoid collecting sensitive personal data unless it is shared
                during a call and required for safety or continuity, and then it
                is stored only in encrypted memory notes.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>How We Use Information</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>We use information to:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Provide scheduled calls, reminders, and check-ins.</li>
                <li>Personalize conversations and improve continuity.</li>
                <li>Deliver safety monitoring and wellness alerts.</li>
                <li>Manage billing, minutes, and subscriptions.</li>
                <li>Respond to support requests and user feedback.</li>
                <li>Maintain reliability, prevent abuse, and secure accounts.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Consent & Choices</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Consent is a core part of Ultaura. We collect consent during
                setup and, when required, directly during calls.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Call consent and opt-outs are respected. A recipient can stop
                  calls at any time by pressing 9 or asking Ultaura to stop.
                </li>
                <li>
                  Recording consent is explicit and can be revoked at any point
                  during a call.
                </li>
                <li>
                  Sharing tiers control what families see in summaries,
                  dashboards, and wellness alerts.
                </li>
                <li>
                  Topic exclusions let you keep sensitive subjects out of
                  summaries and insights.
                </li>
                <li>
                  Retention controls and deletion requests are available in the
                  Privacy Center.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Recordings</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Recordings are optional. If enabled, we request clear consent
                from the person receiving calls. Recording settings can be
                changed at any time, and consent can be revoked during a call.
              </p>
              <p>
                Recordings, if stored, are encrypted and subject to retention
                settings. If recording is disabled or consent is revoked, we do
                not record the call.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Sharing Tiers & Visibility</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Families can receive summaries and insights based on the sharing
                tier you choose. Sharing tiers range from minimal visibility to
                more detailed summaries. You can change sharing tiers at any
                time.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Account owners can view line-level dashboards based on the
                  sharing tier for each line.
                </li>
                <li>
                  Trusted contacts may receive wellness alerts only when enabled
                  and only with the minimum information needed to help.
                </li>
                <li>
                  We do not include exact quotes or sensitive private topics in
                  shared summaries.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Safety Alerts & Wellness Monitoring</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura monitors for distress keywords and concerning patterns
                to support safety. When a concern is detected, we may create a
                wellness alert with a severity level.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Alerts can be shared with trusted contacts if enabled.</li>
                <li>
                  Alerts are redacted to include only what is necessary to act.
                </li>
                <li>
                  In serious situations, the system may suggest emergency
                  resources, such as 988 or local emergency services.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>AI Processing & Automation</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                Ultaura uses AI to power conversations, summarize calls, and
                detect wellness signals. This processing is automated and helps
                deliver reminders, maintain memory notes, and produce summaries.
              </p>
              <p>
                Automated outputs are filtered to honor sharing tiers, topic
                exclusions, and consent settings.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Security & Encryption</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                We encrypt sensitive data in transit and at rest. Memory notes
                and insights are protected with envelope encryption and
                account-level or line-level keys. Access is limited to
                authorized systems and personnel.
              </p>
              <p>
                We monitor for abuse, restrict administrative access, and keep
                audit logs of privacy-related changes.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Retention & Deletion</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You control how long data is retained. Retention options include
                30, 90, or 365 days, or indefinite retention when required for
                continuity. Retention settings apply to memory notes, insights,
                and recordings.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  You can delete privacy data (memories, insights, recordings)
                  from the Privacy Center.
                </li>
                <li>
                  Call metadata, billing records, and user-created schedules are
                  preserved as needed for billing, compliance, and scheduling.
                </li>
                <li>
                  Full account deletion removes lines, schedules, and stored
                  data within reasonable timeframes, except where we are
                  required to retain records.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Data Exports</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You can request a data export that includes call history,
                insights, and memories. Exports are delivered as a secure
                download and are available for 48 hours.
              </p>
              <p>
                For your security, we may verify your identity before fulfilling
                a request.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Service Providers</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                We use trusted providers for telephony, AI processing, cloud
                infrastructure, data storage, payments, and email delivery.
                These providers may process data on our behalf under
                confidentiality and security obligations.
              </p>
              <p>
                We share only what is needed for them to deliver the service.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Your Rights & Controls</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                You can access, correct, export, or delete your data. You can
                also manage consent, sharing tiers, and retention settings at
                any time.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Line recipients can opt out of calls or change consent and
                  sharing preferences.
                </li>
                <li>
                  Account owners can manage billing data, lines, schedules, and
                  trusted contacts.
                </li>
                <li>
                  If you need help exercising these rights, contact support.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>U.S. State Privacy Rights</Heading>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>
                If you live in certain U.S. states, you may have additional
                privacy rights under state law. These rights can include:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Access to the personal information we hold about you.</li>
                <li>Correction of inaccurate personal information.</li>
                <li>Deletion of personal information.</li>
                <li>
                  A portable copy of your personal information (data
                  portability).
                </li>
                <li>
                  Opting out of the sale or sharing of personal information,
                  targeted advertising, and profiling in furtherance of
                  decisions that produce legal or similarly significant
                  effects.
                </li>
              </ul>
              <p>
                To exercise these rights, use the Privacy Center or email{' '}
                <a className="underline" href="mailto:support@ultaura.com">
                  support@ultaura.com
                </a>
                . We may need to verify your identity before fulfilling a
                request, and we may decline or limit a request as permitted by
                law (for example, when we must retain information for billing,
                compliance, or security).
              </p>
              <p>
                <strong>Do Not Sell or Share:</strong> Ultaura does not sell or
                share personal information as those terms are defined by
                applicable U.S. state privacy laws. We do not use personal
                information for targeted advertising, and we do not use
                automated profiling to make decisions that produce legal or
                similarly significant effects. If this changes, we will provide
                a clear opt-out.
              </p>
              <p>
                <strong>Authorized Agents:</strong> You may designate an
                authorized agent to submit a request on your behalf. We will
                require proof of authorization and may verify your identity
                directly with you.
              </p>
              <p>
                <strong>Appeals:</strong> If we deny a request, you can appeal
                by contacting support with the subject line &quot;Privacy
                Appeal.&quot; We will respond within the timeframe required by
                applicable law.
              </p>
              <p>
                <strong>No Discrimination:</strong> We will not discriminate
                against you for exercising your privacy rights. You will not be
                denied services, charged different prices, or receive a
                different level of quality for exercising your rights.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <Heading type={2}>International Processing</Heading>
            <p className="text-lg text-muted-foreground">
              Ultaura is a U.S.-based service. Your information may be processed
              in the United States and other locations where our service
              providers operate.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Children&apos;s Privacy</Heading>
            <p className="text-lg text-muted-foreground">
              Ultaura is intended for adults. We do not knowingly collect
              personal information from children under 18.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Changes to This Policy</Heading>
            <p className="text-lg text-muted-foreground">
              We may update this policy from time to time. If changes are
              material, we will provide notice on this page or in your
              dashboard.
            </p>
          </section>

          <section className="space-y-4">
            <Heading type={2}>Contact Us</Heading>
            <p className="text-lg text-muted-foreground">
              Questions about privacy? Email{' '}
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

export default withI18n(PrivacyPage);
