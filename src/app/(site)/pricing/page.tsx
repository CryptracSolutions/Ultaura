import { CheckCircleIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import { UltauraPricingTable } from '~/components/ultaura/PricingTable';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Pricing - Ultaura Voice Companion',
};

function PricingPage() {
  return (
    <Container>
      <div className={'flex flex-col space-y-16 my-8'}>
        <div className={'flex flex-col items-center space-y-4'}>
          <Heading type={1}>Simple, Transparent Pricing</Heading>

          <SubHeading className="text-sm sm:text-base">
            <span className="flex flex-col items-center gap-1 text-muted-foreground sm:flex-row sm:gap-2">
              <span className="inline-flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-primary" />
                All plans include a 3-day free trial
              </span>
              <span className="text-muted-foreground/80">No credit card required to start</span>
            </span>
          </SubHeading>
        </div>

        <UltauraPricingTable />
      </div>
    </Container>
  );
}

export default withI18n(PricingPage);
