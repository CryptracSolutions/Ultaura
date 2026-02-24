import {
  Button,
  Heading,
  Hr,
  Section,
  Text,
  render,
} from '@react-email/components';
import React from 'react';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';
import {
  CHANGELOG_CATEGORY_META,
  type ChangelogEmailEntry,
} from '~/lib/ultaura/changelog-shared';

export interface ChangelogEmailTemplateParams {
  entries: ChangelogEmailEntry[];
  recipientName?: string;
  dashboardUrl: string;
  previewText?: string;
  baseUrl?: string;
}

export function renderChangelogEmail(
  params: ChangelogEmailTemplateParams,
): { html: string; text: string } {
  const { entries, recipientName, dashboardUrl, previewText, baseUrl } = params;
  const firstEntry = entries[0];
  const trimmedRecipientName = recipientName?.trim();
  const preview = previewText?.trim() || firstEntry?.title || 'What’s New at Ultaura';
  const greeting = trimmedRecipientName ? `Hi ${trimmedRecipientName},` : null;

  const jsx = (
    <EmailLayout preview={preview} baseUrl={baseUrl}>
      {greeting ? (
        <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">{greeting}</Text>
      ) : null}

      <Heading className="text-[22px] font-semibold text-stone-900 mt-[14px] mb-0 text-center">
        What&apos;s New
      </Heading>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0 text-center">
        Here&apos;s what we&apos;ve been working on:
      </Text>

      <Section className="mt-[18px]">
        {entries.map((entry, index) => {
          const categoryMeta = CHANGELOG_CATEGORY_META[entry.category];

          return (
            <Section key={`${entry.category}-${entry.title}-${index}`}>
              {index > 0 ? (
                <Hr
                  className="my-[16px] mx-0 w-full"
                  style={{ borderColor: brandColors.border }}
                />
              ) : null}

              <Text
                className="text-[12px] font-semibold uppercase tracking-wide mt-0 mb-[6px]"
                style={{ color: categoryMeta.emailTextColor }}
              >
                {categoryMeta.label}
              </Text>

              <Text className="text-[15px] text-stone-900 mt-0 mb-[6px]" style={{ fontWeight: 600 }}>
                {entry.title}
              </Text>

              <Text className="text-[14px] text-stone-700 mt-0 mb-0">
                {entry.description}
              </Text>
            </Section>
          );
        })}
      </Section>

      <Section className="mt-[20px] text-center">
        <Button
          href={dashboardUrl}
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
        >
          View Your Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );

  return {
    html: render(jsx),
    text: render(jsx, { plainText: true }),
  };
}

export default renderChangelogEmail;
