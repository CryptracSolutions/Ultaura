import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import React from 'react';

import { brandColors } from '~/lib/brand-colors';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  signOff?: string; // Default: '- The Ultaura Team'
  footerLinks?: Array<{ label: string; href: string }>;
  aiDisclaimer?: boolean;
  baseUrl?: string;
}

export function EmailLayout({
  preview,
  children,
  signOff = '- The Ultaura Team',
  footerLinks,
  aiDisclaimer = false,
  baseUrl,
}: EmailLayoutProps) {
  const siteUrl = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const normalizedSiteUrl = siteUrl.replace(/\/$/, '');
  // Inline the logo as a data URI so it renders in every environment
  // (Inbucket, Gmail, Outlook) without depending on an external URL.
  const logoUrl = `data:image/png;base64,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`;

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style
          dangerouslySetInnerHTML={{
            __html: `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');`,
          }}
        />
      </Head>
      <Preview>{preview}</Preview>

      <Tailwind>
        <Body
          className="bg-stone-50 my-auto mx-auto"
          style={{
            fontFamily:
              "Manrope, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          <Container
            className="rounded-lg my-[32px] mx-auto p-[24px] bg-white"
            style={{
              maxWidth: '560px',
              width: '100%',
              border: `1px solid ${brandColors.border}`,
            }}
          >
            <Section className="mt-[4px] mb-[16px]">
              <table
                cellPadding="0"
                cellSpacing="0"
                role="presentation"
                style={{ border: 'none' }}
              >
                <tr>
                  <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}>
                    <Img
                      src={logoUrl}
                      width="36"
                      height="36"
                      alt="Ultaura"
                      style={{ display: 'block' }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <Text
                      className="m-0 text-[18px] font-semibold"
                      style={{
                        color: brandColors.primary,
                        lineHeight: '1',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Ultaura
                    </Text>
                  </td>
                </tr>
              </table>
            </Section>

            {children}

            <Text className="text-[14px] text-stone-700 mt-[18px] mb-0">
              {signOff}
            </Text>

            <Hr
              className="my-[20px] mx-0 w-full"
              style={{ borderColor: brandColors.border }}
            />

            {aiDisclaimer && (
              <Text className="text-[12px] text-stone-500 m-0 text-center">
                These insights are generated by AI based on conversation
                patterns and are not medical, clinical, or professional advice.
                Ultaura is not an emergency service. If you believe there is
                immediate danger, contact local emergency services (911 in the
                US).
              </Text>
            )}

            <Text className="text-[12px] text-stone-500 mt-[8px] mb-0 text-center">
              Companionship, one call at a time.
            </Text>

            {footerLinks?.length ? (
              <Text className="text-[12px] text-stone-500 mt-[8px] mb-0 text-center">
                {footerLinks.map((link, index) => (
                  <span key={link.href}>
                    {index > 0 && ' | '}
                    <Link
                      href={link.href}
                      style={{ color: brandColors.primary }}
                    >
                      {link.label}
                    </Link>
                  </span>
                ))}
              </Text>
            ) : null}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
