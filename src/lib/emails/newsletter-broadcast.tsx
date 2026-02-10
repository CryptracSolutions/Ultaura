import {
  Button,
  Heading,
  Link,
  Section,
  Text,
  render,
} from '@react-email/components';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

type NewsletterBroadcastCtaVariant = 'button' | 'link';

interface NewsletterBroadcastCta {
  label: string;
  href: string;
  variant?: NewsletterBroadcastCtaVariant;
}

interface NewsletterBroadcastBulletItem {
  label: string;
  href?: string;
}

interface NewsletterBroadcastEmailProps {
  firstName?: string;
  subject: string;
  topicLabel: string;
  paragraphs: string[];
  bulletItems?: Array<string | NewsletterBroadcastBulletItem>;
  cta?: NewsletterBroadcastCta;
  unsubscribeUrl: string;
  previewText?: string;
  baseUrl?: string;
}

function normalizeTextList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeBulletItems(
  values: Array<string | NewsletterBroadcastBulletItem>,
): NewsletterBroadcastBulletItem[] {
  return values
    .map((value) => {
      if (typeof value === 'string') {
        return { label: value.trim() };
      }

      return {
        label: value.label.trim(),
        href: value.href?.trim() || undefined,
      };
    })
    .filter((value) => Boolean(value.label));
}

export default function renderNewsletterBroadcastEmail(
  props: NewsletterBroadcastEmailProps,
): { html: string; text: string } {
  const greetingName = props.firstName?.trim() || 'there';
  const previewText = props.previewText?.trim() || props.subject;
  const paragraphs = normalizeTextList(props.paragraphs);
  const bulletItems = normalizeBulletItems(props.bulletItems ?? []);

  const jsx = (
    <EmailLayout
      preview={previewText}
      footerLinks={[
        { label: 'Unsubscribe', href: props.unsubscribeUrl },
      ]}
      baseUrl={props.baseUrl}
    >
      <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">
        Hi {greetingName},
      </Text>

      <Heading className="text-[22px] font-semibold text-stone-900 mt-[14px] mb-0">
        {props.subject}
      </Heading>

      <Section className="mt-[12px]">
        <Text
          className="text-[12px] font-semibold m-0 inline-block uppercase tracking-wide"
          style={{
            color: brandColors.stone[700],
            backgroundColor: brandColors.stone[100],
            border: `1px solid ${brandColors.border}`,
            borderRadius: '999px',
            padding: '4px 10px',
          }}
        >
          {props.topicLabel}
        </Text>
      </Section>

      {paragraphs.map((paragraph, index) => (
        <Text
          key={`${index}-${paragraph.slice(0, 24)}`}
          className="text-[14px] text-stone-700 mt-[10px] mb-0"
        >
          {paragraph}
        </Text>
      ))}

      {bulletItems.length > 0 ? (
        <Section className="mt-[14px] rounded-md bg-stone-50 px-[16px] py-[12px]">
          {bulletItems.map((item, index) => (
            <Text
              key={`${index}-${item.label.slice(0, 24)}`}
              className={index === 0 ? 'text-[14px] text-stone-700 m-0' : 'text-[14px] text-stone-700 mt-[8px] mb-0'}
            >
              -{' '}
              {item.href ? (
                <Link href={item.href} style={{ color: brandColors.primary }}>
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
            </Text>
          ))}
        </Section>
      ) : null}

      {props.cta ? (
        props.cta.variant === 'link' ? (
          <Section className="mt-[18px]">
            <Link
              href={props.cta.href}
              className="text-[14px] font-semibold"
              style={{ color: brandColors.primary }}
            >
              {props.cta.label}
            </Link>
          </Section>
        ) : (
          <Section className="mt-[20px] text-center">
            <Button
              href={props.cta.href}
              className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
              style={{ backgroundColor: brandColors.primary }}
            >
              {props.cta.label}
            </Button>
          </Section>
        )
      ) : null}
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
