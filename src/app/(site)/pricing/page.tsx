import { CheckCircleIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import { UltauraPricingTable } from '~/components/ultaura/PricingTable';
import { withI18n } from '~/i18n/with-i18n';
import { PageHero, GradientText } from '~/app/(site)/components/PageHero';

export const metadata = {
  title: 'Pricing - Ultaura Voice Companion',
};

function PricingPage() {
  return (
    <div>
      <PageHero
        badge="PRICING"
        title={
          <>
            Simple, <GradientText>Transparent</GradientText> Pricing
          </>
        }
      >
        <span className="flex flex-col items-center gap-1 text-sm sm:text-base text-muted-foreground sm:flex-row sm:gap-2">
          <span className="inline-flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-primary" />
            All plans include a 3-day free trial
          </span>
          <span className="text-muted-foreground/80">
            No credit card required to start
          </span>
        </span>
      </PageHero>

      <Container>
        <div className="my-8">
          <UltauraPricingTable />
        </div>
      </Container>
    </div>
  );
}

export default withI18n(PricingPage);
