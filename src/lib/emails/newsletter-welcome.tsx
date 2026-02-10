import {
  Text,
  render,
} from '@react-email/components';

import { EmailLayout } from '~/lib/emails/components/email-layout';

type TopicKey = 'blog_digest' | 'elder_care_tips' | 'product_updates';

interface NewsletterWelcomeProps {
  firstName?: string;
  subscribedTopics: TopicKey[];
  preferencesUrl?: string;
  unsubscribeUrl?: string;
  baseUrl?: string;
}

export default function renderNewsletterWelcomeEmail(
  props: NewsletterWelcomeProps,
): { html: string; text: string } {
  const previewText = 'Welcome to the Ultaura newsletter';

  const jsx = (
    <EmailLayout
      preview={previewText}
      footerLinks={props.unsubscribeUrl ? [{ label: 'Unsubscribe', href: props.unsubscribeUrl }] : []}
      baseUrl={props.baseUrl}
    >
      <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">
        Hi {props.firstName || 'there'},
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        Welcome to the Ultaura newsletter! You're all set.
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[14px] mb-0">
        We'll keep you in the loop with updates from Ultaura.
      </Text>
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
