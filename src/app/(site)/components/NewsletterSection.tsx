import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import NewsletterForm from './NewsletterForm';

function NewsletterSection() {
  return (
    <section className="bg-surface-subtle py-16">
      <Container>
        <div className="flex flex-col items-center text-center">
          <Heading type={2}>Stay in the loop</Heading>
          <SubHeading>
            Elder care tips, product updates, and stories from families like
            yours.
          </SubHeading>

          <div className="max-w-md mx-auto mt-8 w-full">
            <NewsletterForm source="homepage" />
          </div>
        </div>
      </Container>
    </section>
  );
}

export default NewsletterSection;
