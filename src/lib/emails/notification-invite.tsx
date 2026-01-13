import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';

interface NotificationInviteProps {
  recipientName: string;
  accountName: string;
  lineName: string;
  inviterName: string;
  confirmLink: string;
}

export default function renderNotificationInviteEmail(props: NotificationInviteProps) {
  const previewText = `You've been invited to receive updates about ${props.lineName}`;

  return render(
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body className="bg-stone-50 my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#e7e5e4] rounded-lg my-[32px] mx-auto p-[24px] w-[560px] bg-white">
            <Heading className="text-[20px] font-semibold text-stone-900 m-0 text-center">
              Ultaura Family Updates
            </Heading>

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
                Confirm updates
              </Button>
            </Section>

            <Text className="text-[13px] text-stone-600 mt-[14px] mb-0">
              No account is required. You can unsubscribe at any time.
            </Text>

            <Hr className="border border-solid border-[#e7e5e4] my-[18px] mx-0 w-full" />

            <Text className="text-[12px] text-stone-500 m-0">
              If the button does not work, copy and paste this link:
            </Text>
            <Text className="text-[12px] text-stone-600 mt-[6px] mb-0">
              <Link href={props.confirmLink} style={{ color: brandColors.primary }}>
                {props.confirmLink}
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>,
  );
}
