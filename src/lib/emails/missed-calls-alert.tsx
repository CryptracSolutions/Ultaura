import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  render,
  Link,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';

interface MissedCallsAlertProps {
  lineName: string;
  consecutiveMissedCount: number;
  dashboardUrl: string;
  settingsUrl: string;
}

export default function renderMissedCallsAlertEmail(props: MissedCallsAlertProps) {
  const previewText = `Missed check-ins for ${props.lineName}`;

  return render(
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body className="bg-stone-50 my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#e7e5e4] rounded-lg my-[32px] mx-auto p-[24px] w-[560px] bg-white">
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

            <Text className="text-[14px] text-stone-700 mt-[16px] mb-0">
              If you&apos;d like to pause calls temporarily, you can do so in{' '}
              <Link href={props.settingsUrl} style={{ color: brandColors.primary }}>
                Line Settings
              </Link>
              .
            </Text>

            <Text className="text-[14px] text-stone-700 mt-[18px] mb-0">
              -- Ultaura
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>,
  );
}
