import {
  Button,
  Column,
  Heading,
  Img,
  Link,
  Row,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

interface Props {
  organizationName: string;
  organizationLogo?: string;
  inviter: Maybe<string>;
  invitedUserEmail: string;
  link: string;
  productName: string;
}

export default function renderInviteEmail(props: Props): { html: string; text: string } {
  const previewText = `Join ${props.invitedUserEmail} on ${props.productName}`;

  const jsx = (
    <EmailLayout preview={previewText}>
      <Heading className="text-[22px] font-semibold text-stone-900 text-center p-0 my-[30px] mx-0">
        Join <strong>{props.organizationName}</strong> on{' '}
        <strong>{props.productName}</strong>
      </Heading>
      <Text className="text-stone-700 text-[14px] leading-[24px]">
        Hello {props.invitedUserEmail},
      </Text>
      <Text className="text-stone-700 text-[14px] leading-[24px]">
        <strong>{props.inviter}</strong> has invited you to the{' '}
        <strong>{props.organizationName}</strong> team on{' '}
        <strong>{props.productName}</strong>.
      </Text>
      {props.organizationLogo && (
        <Section>
          <Row>
            <Column align="center">
              <Img
                className="rounded-full"
                src={props.organizationLogo}
                width="64"
                height="64"
              />
            </Column>
          </Row>
        </Section>
      )}
      <Section className="text-center mt-[32px] mb-[32px]">
        <Button
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
          href={props.link}
        >
          Join {props.organizationName}
        </Button>
      </Section>
      <Text className="text-stone-700 text-[14px] leading-[24px]">
        or copy and paste this URL into your browser:{' '}
        <Link
          href={props.link}
          className="no-underline"
          style={{ color: brandColors.primary }}
        >
          {props.link}
        </Link>
      </Text>
      <Text className="text-stone-500 text-[12px] leading-[24px]">
        This invitation was intended for{' '}
        <span className="text-stone-900">{props.invitedUserEmail}</span>.
      </Text>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
