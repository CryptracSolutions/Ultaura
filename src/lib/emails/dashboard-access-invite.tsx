import { Button, Link, Section, Text, render } from '@react-email/components';
import React from 'react';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

export interface DashboardAccessInviteProps {
  recipientName: string;
  accountName: string;
  seniorName: string;
  inviterName: string;
  signupLink: string;
  baseUrl?: string;
}

export default function renderDashboardAccessInviteEmail(
  {
    recipientName,
    accountName,
    seniorName,
    inviterName,
    signupLink,
    baseUrl,
  }: DashboardAccessInviteProps,
): { html: string; text: string } {
  const previewText = `${inviterName} shared ${seniorName}'s dashboard with you`;

  const jsx = (
    <EmailLayout preview={previewText} baseUrl={baseUrl}>
      <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">Hi {recipientName},</Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        {inviterName} has given you access to view {seniorName}'s care dashboard on Ultaura for{' '}
        {accountName}.
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        Create your free account to get started.
      </Text>

      <Section className="mt-[22px] text-center">
        <Button
          href={signupLink}
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
        >
          Create Account
        </Button>
      </Section>

      <Text className="text-[12px] text-stone-500 mt-[14px] mb-0">
        If the button does not work, copy and paste this link:{' '}
        <Link href={signupLink} style={{ color: brandColors.primary }}>
          {signupLink}
        </Link>
      </Text>
    </EmailLayout>
  );

  return {
    html: render(jsx),
    text: render(jsx, { plainText: true }),
  };
}
