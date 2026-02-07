import {
  Heading,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

interface SecurityAlertEmailProps {
  anomalyType: string;
  source: string;
  sourceType: string;
  timestamp: string;
  detailsJson: string;
  recommendedAction: string;
}

function formatAnomalyType(type: string): string {
  return type.replace(/_/g, ' ');
}

function renderSecurityAlertEmail(props: SecurityAlertEmailProps): { html: string; text: string } {
  const jsx = (
    <EmailLayout preview={`Security Alert: ${formatAnomalyType(props.anomalyType)}`}>
      <Heading className="text-[22px] font-semibold text-stone-900 m-0">
        Security Alert
      </Heading>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        <strong>Type:</strong> {props.anomalyType}
      </Text>
      <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
        <strong>Source:</strong> {props.source} ({props.sourceType})
      </Text>
      <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
        <strong>Timestamp:</strong> {props.timestamp}
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        <strong>Details:</strong>
      </Text>
      <Section
        className="mt-[6px] rounded-md px-[12px] py-[10px]"
        style={{ backgroundColor: brandColors.stone[100] }}
      >
        <Text
          className="text-[12px] text-stone-700 m-0 whitespace-pre-wrap"
          style={{ fontFamily: 'monospace' }}
        >
          {props.detailsJson}
        </Text>
      </Section>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        <strong>Recommended actions:</strong> {props.recommendedAction}
      </Text>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}

export default renderSecurityAlertEmail;
