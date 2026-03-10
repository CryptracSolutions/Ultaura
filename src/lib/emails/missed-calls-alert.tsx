import {
  Button,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

interface MissedCallsAlertProps {
  lineName: string;
  consecutiveMissedCount: number;
  dashboardUrl: string;
  settingsUrl: string;
  hasDashboardAccess?: boolean;
  unsubscribeLink?: string;
}

export default function renderMissedCallsAlertEmail(props: MissedCallsAlertProps): { html: string; text: string } {
  const previewText = `Missed check-ins for ${props.lineName}`;

  const footerLinks: Array<{ label: string; href: string }> = [];
  if (props.hasDashboardAccess) {
    footerLinks.push({ label: 'Line Settings', href: props.settingsUrl });
  }
  if (props.unsubscribeLink) {
    footerLinks.push({ label: 'Unsubscribe', href: props.unsubscribeLink });
  }

  const jsx = (
    <EmailLayout preview={previewText} footerLinks={footerLinks}>
      <Text className="text-[14px] text-stone-700 m-0">Hi there,</Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        {props.lineName} has missed {props.consecutiveMissedCount} consecutive scheduled
        check-ins with Ultaura.
      </Text>

      <Section className="mt-[16px]">
        <Text className="text-[14px] text-stone-700 m-0">This could mean:</Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          - Phone is off or out of reach
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[4px] mb-0">
          - They may be busy or away
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[4px] mb-0">
          - {props.hasDashboardAccess ? 'Line settings may need adjustment' : 'The account holder may need to adjust line settings'}
        </Text>
      </Section>

      <Section className="mt-[16px]">
        <Text className="text-[14px] text-stone-700 m-0">What you can do:</Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          - Give them a call to check in
        </Text>
        {props.hasDashboardAccess ? (
          <Text className="text-[14px] text-stone-700 mt-[4px] mb-0">
            - Review call schedule in your dashboard
          </Text>
        ) : null}
      </Section>

      {!props.hasDashboardAccess ? (
        <Text className="text-[12px] text-stone-500 mt-[16px] mb-0">
          You are receiving email updates only. If you&apos;d like dashboard access,
          please contact the account holder to activate it.
        </Text>
      ) : null}

      {props.hasDashboardAccess ? (
        <Section className="mt-[20px] text-center">
          <Button
            href={props.dashboardUrl}
            className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
            style={{ backgroundColor: brandColors.primary }}
          >
            View Dashboard
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
