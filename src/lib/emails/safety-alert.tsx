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
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';

interface SafetyAlertEmailProps {
  lineName: string;
  actionTaken: string;
  severity: 'high';
  dashboardUrl: string;
}

const SEVERITY_LABELS: Record<SafetyAlertEmailProps['severity'], string> = {
  high: 'Urgent',
};

export default function renderSafetyAlertEmail(props: SafetyAlertEmailProps) {
  const previewText = `Safety alert for ${props.lineName}`;

  return render(
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body className="bg-stone-50 my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#e7e5e4] rounded-lg my-[32px] mx-auto p-[24px] w-[560px] bg-white">
            <Text className="text-[14px] text-stone-700 m-0">Hi,</Text>

            <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
              We detected a safety alert during a call with {props.lineName}.
            </Text>

            <Section className="mt-[16px] rounded-md bg-stone-50 px-[16px] py-[12px]">
              <Text className="text-[12px] uppercase tracking-wide text-stone-500 m-0">
                {SEVERITY_LABELS[props.severity]} Alert
              </Text>
              <Text className="text-[16px] font-semibold text-stone-800 mt-[6px] mb-0">
                Action taken
              </Text>
              <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
                {props.actionTaken}
              </Text>
            </Section>

            <Section className="mt-[18px]">
              <Text className="text-[14px] text-stone-700 m-0">
                Suggested next step: reach out and check in.
              </Text>
              <Text className="text-[12px] text-stone-500 mt-[6px] mb-0">
                If you believe there is immediate danger, contact local emergency
                services (911 in the US).
              </Text>
            </Section>

            <Section className="mt-[20px] text-center">
              <Button
                href={props.dashboardUrl}
                className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
                style={{ backgroundColor: brandColors.primary }}
              >
                View Safety Alerts
              </Button>
            </Section>

            <Text className="text-[14px] text-stone-700 mt-[18px] mb-0">
              -- Ultaura
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>,
  );
}
