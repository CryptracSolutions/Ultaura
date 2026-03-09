import {
  Button,
  Link,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

interface NotificationInviteProps {
  recipientName: string;
  accountName: string;
  lineName: string;
  inviterName: string;
  confirmLink: string;
}

export default function renderNotificationInviteEmail(props: NotificationInviteProps): { html: string; text: string } {
  const previewText = `You've been invited to receive updates about ${props.lineName}`;

  const jsx = (
    <EmailLayout preview={previewText}>
      <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">
        Hi {props.recipientName},
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        {props.inviterName} has invited you to receive updates about {props.lineName} from{' '}
        {props.accountName}.
      </Text>

      <Section className="mt-[16px]">
        <Text className="text-[14px] text-stone-700 m-0">
          You will receive:
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          - Weekly check-in summaries
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[4px] mb-0">
          - Wellness and missed call alerts
        </Text>
      </Section>

      <Section className="mt-[22px] text-center">
        <Button
          href={props.confirmLink}
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
        >
          Yes, notify me
        </Button>
      </Section>

      <Text className="text-[14px] text-stone-700 mt-[14px] mb-0">
        No account is required. You can unsubscribe at any time.
      </Text>

      <Text className="text-[12px] text-stone-500 mt-[14px] mb-0">
        If the button does not work, copy and paste this link:{' '}
        <Link href={props.confirmLink} style={{ color: brandColors.primary }}>
          {props.confirmLink}
        </Link>
      </Text>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
