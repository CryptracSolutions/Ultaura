import { Button, Link, Section, Text, render } from '@react-email/components';
import React from 'react';

import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

export interface DashboardAccessGrantedProps {
  recipientName: string;
  accountName: string;
  seniorName: string;
  inviterName: string;
  loginLink: string;
  baseUrl?: string;
}

export default function renderDashboardAccessGrantedEmail(
  {
    recipientName,
    accountName,
    seniorName,
    inviterName,
    loginLink,
    baseUrl,
  }: DashboardAccessGrantedProps,
): { html: string; text: string } {
  const previewText = `You now have dashboard access for ${seniorName}`;

  const jsx = (
    <EmailLayout preview={previewText} baseUrl={baseUrl}>
      <Text className="text-[14px] text-stone-700 mt-[20px] mb-0">Hi {recipientName},</Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
        {inviterName} has given you access to view {seniorName}'s care dashboard on Ultaura for{' '}
        {accountName}.
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">Log in to start viewing.</Text>

      <Section className="mt-[22px] text-center">
        <Button
          href={loginLink}
          className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
          style={{ backgroundColor: brandColors.primary }}
        >
          View Dashboard
        </Button>
      </Section>

      <Text className="text-[12px] text-stone-500 mt-[14px] mb-0">
        If the button does not work, copy and paste this link:{' '}
        <Link href={loginLink} style={{ color: brandColors.primary }}>
          {loginLink}
        </Link>
      </Text>
    </EmailLayout>
  );

  return {
    html: render(jsx),
    text: render(jsx, { plainText: true }),
  };
}
