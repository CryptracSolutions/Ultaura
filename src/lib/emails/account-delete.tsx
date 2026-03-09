import {
  Heading,
  Text,
  render,
} from '@react-email/components';

import { EmailLayout } from '~/lib/emails/components/email-layout';

interface Props {
  productName: string;
  userDisplayName: string;
}

function renderAccountDeleteEmail(props: Props): { html: string; text: string } {
  const previewText = `We have deleted your ${props.productName} account`;

  const jsx = (
    <EmailLayout preview={previewText}>
      <Heading className="text-[22px] font-semibold text-stone-900 text-center p-0 my-[30px] mx-0">
        {previewText}
      </Heading>

      <Text className="text-stone-700 text-[14px] leading-[24px]">
        Hello {props.userDisplayName},
      </Text>

      <Text className="text-stone-700 text-[14px] leading-[24px]">
        This is to confirm that we&apos;ve processed your request to
        delete your account. This action is irreversible, and all of
        your data will be removed from our systems.
      </Text>

      <Text className="text-stone-700 text-[14px] leading-[24px]">
        We&apos;re sorry to see you go. Thank you for being part of {props.productName}.
      </Text>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}

export default renderAccountDeleteEmail;
