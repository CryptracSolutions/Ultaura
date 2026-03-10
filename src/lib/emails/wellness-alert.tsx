import {
  Button,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

interface WellnessAlertEmailProps {
  lineName: string;
  title: string;
  summary: string;
  severity: 'info' | 'warning' | 'urgent';
  dashboardUrl: string;
  settingsUrl: string;
  hasDashboardAccess?: boolean;
  unsubscribeLink?: string;
}

const SEVERITY_LABELS: Record<WellnessAlertEmailProps['severity'], string> = {
  info: 'Info',
  warning: 'Attention',
  urgent: 'Urgent',
};

export default function renderWellnessAlertEmail(props: WellnessAlertEmailProps): { html: string; text: string } {
  const previewText = `Wellness alert for ${props.lineName}`;

  const footerLinks: Array<{ label: string; href: string }> = [];
  if (props.hasDashboardAccess) {
    footerLinks.push({ label: 'Alert Settings', href: props.settingsUrl });
  }
  if (props.unsubscribeLink) {
    footerLinks.push({ label: 'Unsubscribe', href: props.unsubscribeLink });
  }

  const jsx = (
    <EmailLayout preview={previewText} footerLinks={footerLinks}>
      <Text className="text-[14px] text-stone-700 m-0">Hi there,</Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        We detected a wellness alert for {props.lineName}.
      </Text>

      <Section className="mt-[16px] rounded-md bg-stone-50 px-[16px] py-[12px]">
        <Text className="text-[12px] uppercase tracking-wide text-stone-500 m-0">
          {SEVERITY_LABELS[props.severity]} Alert
        </Text>
        <Text className="text-[16px] font-semibold text-stone-800 mt-[6px] mb-0">
          {props.title}
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          {props.summary}
        </Text>
      </Section>

      <Section className="mt-[18px]">
        <Text className="text-[14px] text-stone-700 m-0">
          Suggested next step: reach out and check in.
        </Text>
        {!props.hasDashboardAccess ? (
          <Text className="text-[12px] text-stone-500 mt-[6px] mb-0">
            You are receiving email updates only. If you&apos;d like dashboard access,
            please contact the account holder to activate it.
          </Text>
        ) : null}
        <Text className="text-[12px] text-stone-500 mt-[6px] mb-0">
          Ultaura alerts are informational and not medical advice.
        </Text>
      </Section>

      {props.hasDashboardAccess ? (
        <Section className="mt-[20px] text-center">
          <Button
            href={props.dashboardUrl}
            className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
            style={{ backgroundColor: brandColors.primary }}
          >
            View Alerts
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
