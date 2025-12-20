import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine } from '~/lib/ultaura/actions';
import { VerifyPhoneClient } from './VerifyPhoneClient';

export const metadata: Metadata = {
  title: 'Verify Phone - Ultaura',
};

interface PageProps {
  params: { organization: string; lineId: string };
}

export default async function VerifyPhonePage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect(`/dashboard/${params.organization}/lines`);
  }

  // Already verified
  if (line.phone_verified_at) {
    redirect(`/dashboard/${params.organization}/lines/${params.lineId}`);
  }

  // Format phone for display
  const formattedPhone = formatPhoneNumber(line.phone_e164);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <VerifyPhoneClient
        lineId={line.id}
        phoneNumber={formattedPhone}
        organizationSlug={params.organization}
      />
    </div>
  );
}

function formatPhoneNumber(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const subscriber = digits.slice(7);
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
  return e164;
}
