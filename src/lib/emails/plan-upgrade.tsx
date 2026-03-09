import {
  Button,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

interface PlanUpgradeEmailProps {
  planName: string;
  planSummary: string;
  checkoutUrl: string;
}

function renderPlanUpgradeEmail(props: PlanUpgradeEmailProps): { html: string; text: string } {
  const jsx = (
    <EmailLayout preview={`Complete your ${props.planName} plan upgrade`}>
      <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">Hi there,</Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        You requested to upgrade to the <strong>{props.planName}</strong> plan.
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        <strong>Plan details:</strong> {props.planSummary}
      </Text>

      <Section className="mt-[20px] text-center">
        <Button
          href={props.checkoutUrl}
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
        >
          Complete your upgrade
        </Button>
      </Section>

      <Text className="text-[12px] text-stone-500 mt-[16px] mb-0">
        If you did not request this, you can ignore this email.
      </Text>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}

export default renderPlanUpgradeEmail;
