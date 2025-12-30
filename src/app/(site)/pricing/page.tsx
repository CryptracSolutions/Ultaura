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

          <SubHeading>
            Choose the plan that fits your family’s needs. All plans include a
            3-day free trial to get started.
          </SubHeading>
        </div>

        <UltauraPricingTable />
      </div>
    </Container>
  );
}

export default withI18n(PricingPage);
