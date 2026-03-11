import {
  Button,
  Link,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

interface RecipientSmsVerificationEmailProps {
  recipientName: string;
  accountName: string;
  inviterName: string;
  verificationLink: string;
  baseUrl?: string;
}

function buildIntroCopy(
  inviterName: string,
  accountName: string,
): string {
  if (inviterName.trim().toLowerCase() === accountName.trim().toLowerCase()) {
    return `SMS alerts were turned on for updates from ${accountName}.`;
  }

  return `${inviterName} turned on SMS alerts for updates from ${accountName}.`;
}

export default function renderRecipientSmsVerificationEmail(
  props: RecipientSmsVerificationEmailProps,
): { html: string; text: string } {
  const previewText = 'Verify your phone for Ultaura text alerts';

  const jsx = (
    <EmailLayout preview={previewText} baseUrl={props.baseUrl}>
      <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">
        Hi {props.recipientName},
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        {buildIntroCopy(props.inviterName, props.accountName)}
      </Text>

      <Section className="mt-[16px] rounded-md bg-stone-50 px-[16px] py-[12px]">
        <Text className="text-[12px] uppercase tracking-wide text-stone-500 m-0">
          Next step
        </Text>
        <Text className="text-[16px] font-semibold text-stone-800 mt-[6px] mb-0">
          Verify your phone number
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          Once verified, Ultaura can send missed call, wellness, and safety
          alerts by text. You can stop messages at any time with STOP and
          restart with START.
        </Text>
      </Section>

      <Section className="mt-[20px] text-center">
        <Button
          href={props.verificationLink}
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
        >
          Verify phone
        </Button>
      </Section>

      <Text className="text-[12px] text-stone-500 mt-[14px] mb-0">
        If the button does not work, copy and paste this link:{' '}
        <Link
          href={props.verificationLink}
          style={{ color: brandColors.primary }}
        >
          {props.verificationLink}
        </Link>
      </Text>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
