import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';

const TESTIMONIALS = [
  {
    content:
      "Ultaura has been a lifesaver. My mom loves the daily calls, and I feel so much better knowing she's chatting with someone.",
    author: 'Sarah M.',
    role: 'Daughter',
  },
  {
    content:
      'I was skeptical at first, but the conversations are surprisingly natural. It really helps with the loneliness.',
    author: 'James P.',
    role: 'Son',
  },
  {
    content:
      'The dashboard gives me peace of mind without being intrusive. Highly recommend for anyone with aging parents.',
    author: 'Emily R.',
    role: 'Caregiver',
  },
];

export function Testimonials() {
  return (
    <div className="bg-muted/30 py-24">
      <Container>
        <div className="flex flex-col items-center space-y-12">
          <div className="text-center space-y-4">
            <Heading type={2}>Loved by families</Heading>
            <SubHeading>Don&apos;t just take our word for it</SubHeading>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                className="flex flex-col space-y-4 p-8 bg-background rounded-2xl border border-border shadow-sm"
              >
                <p className="text-muted-foreground italic">
                  &quot;{testimonial.content}&quot;
                </p>
                <div>
                  <div className="font-semibold text-foreground">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}

