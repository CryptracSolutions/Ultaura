import { Metadata } from 'next';
import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';

export const metadata: Metadata = {
  title: 'Subscription Confirmed',
};

export default function NewsletterConfirmedPage() {
  return (
    <section className="py-24 text-center">
      <Container>
        <div className="flex flex-col items-center space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <Heading type={2}>You&apos;re subscribed!</Heading>

          <SubHeading>
            Thanks for joining the Ultaura newsletter. Your first email is on
            its way.
          </SubHeading>

          <Button href="/" round>
            Back to Home
          </Button>
        </div>
      </Container>
    </section>
  );
}
