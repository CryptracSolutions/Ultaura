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
  unsubscribeLink?: string;
}

export default function renderMissedCallsAlertEmail(props: MissedCallsAlertProps): { html: string; text: string } {
  const previewText = `Missed check-ins for ${props.lineName}`;

  const footerLinks: Array<{ label: string; href: string }> = [
    { label: 'Line Settings', href: props.settingsUrl },
  ];
  if (props.unsubscribeLink) {
    footerLinks.push({ label: 'Unsubscribe', href: props.unsubscribeLink });
  }

  const jsx = (
    <EmailLayout preview={previewText} footerLinks={footerLinks}>
      <Text className="text-[14px] text-stone-700 m-0">Hi,</Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        {props.lineName} has missed {props.consecutiveMissedCount} consecutive scheduled
        calls from Ultaura.
      </Text>

      <Section className="mt-[16px]">
        <Text className="text-[14px] text-stone-700 m-0">This could mean:</Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          - Phone is off or out of reach
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[4px] mb-0">
          - They&apos;re busy or away
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[4px] mb-0">
          - Line settings may need adjustment
        </Text>
      </Section>

      <Section className="mt-[16px]">
        <Text className="text-[14px] text-stone-700 m-0">What you can do:</Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          - Give them a call to check in
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[4px] mb-0">
          - Review call schedule in your dashboard
        </Text>
      </Section>

      <Section className="mt-[20px] text-center">
        <Button
          href={props.dashboardUrl}
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
        >
          View Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
