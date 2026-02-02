'use client';

import { useMemo, useState } from 'react';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';

const TESTIMONIALS = [
  {
    highlight: 'Ultaura has been a lifesaver.',
    content:
      "My mom loves the daily calls, and I feel better knowing she's chatting with someone who remembers her stories and asks about them.",
    author: 'Sarah M.',
    role: 'Daughter',
    date: 'May 2024',
  },
  {
    highlight:
      'I was skeptical at first, but the conversations are surprisingly natural.',
    content: 'It helps my dad with the loneliness between visits.',
    author: 'James P.',
    role: 'Son',
    date: 'April 2024',
  },
  {
    highlight: 'The dashboard gives me peace of mind without being intrusive.',
    content:
      'My aunt is in assisted living, and Ultaura helped her open up about her day and share her garden updates. I can see the call duration and timing, then check in when I need to, which makes it feel like I am there without being overwhelming.',
    author: 'Emily R.',
    role: 'Caregiver',
    date: 'March 2024',
  },
  {
    highlight: 'My grandfather answers every call.',
    content: 'He says it feels like a friend checking in.',
    author: 'Nina K.',
    role: 'Granddaughter',
    date: 'February 2024',
  },
  {
    highlight: 'Ultaura helped my dad stay more social.',
    content:
      'The calls give him a little routine, and I can see that he is doing well without hovering or asking him to repeat himself.',
    author: 'Marcus T.',
    role: 'Son',
    date: 'January 2024',
  },
  {
    highlight: 'My mom has hearing issues, but the voice clarity is great.',
    content: '',
    author: 'Priya S.',
    role: 'Daughter',
    date: 'December 2023',
  },
  {
    highlight: 'The setup was easy, and my aunt never had to install anything.',
    content:
      'She just picks up the phone and chats, which keeps her independent and in a good mood.',
    author: 'Leo B.',
    role: 'Nephew',
    date: 'November 2023',
  },
  {
    highlight: 'It is reassuring to see call duration and cadence.',
    content: '',
    author: 'Renee D.',
    role: 'Caregiver',
    date: 'October 2023',
  },
  {
    highlight: 'My grandmother says it feels like someone truly listens.',
    content:
      'That means everything to our family and gives us a little peace between visits.',
    author: 'Omar A.',
    role: 'Grandson',
    date: 'September 2023',
  },
  {
    highlight:
      'We set up a weekly cadence and my dad actually asks when the next call is.',
    content: '',
    author: 'Hannah L.',
    role: 'Daughter',
    date: 'August 2023',
  },
  {
    highlight: 'Ultaura feels respectful.',
    content:
      'My mom likes that it always says it is an AI, and the tone is gentle.',
    author: 'Luis C.',
    role: 'Son',
    date: 'July 2023',
  },
  {
    highlight: 'The calls give my uncle a little spark in his day.',
    content: 'It has been a bright spot for him and for us.',
    author: 'Grace W.',
    role: 'Niece',
    date: 'June 2023',
  },
  {
    highlight: 'Ultaura checks in with my parents on the days I cannot.',
    content:
      'It keeps them engaged and gives me a gentle nudge to follow up.',
    author: 'Devon R.',
    role: 'Son',
    date: 'May 2023',
  },
  {
    highlight: 'My grandmother laughs more after the calls.',
    content:
      'She tells me about the questions she was asked and the memories it brought back.',
    author: 'Aisha N.',
    role: 'Granddaughter',
    date: 'April 2023',
  },
  {
    highlight: 'The rhythm is perfect.',
    content:
      'Short, friendly conversations that never feel pushy, but still help my dad feel connected.',
    author: 'Caleb M.',
    role: 'Son',
    date: 'March 2023',
  },
];

export function Testimonials() {
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 3;
  const pageCount = Math.ceil(TESTIMONIALS.length / pageSize);

  const visibleTestimonials = useMemo(() => {
    const start = pageIndex * pageSize;
    return TESTIMONIALS.slice(start, start + pageSize);
  }, [pageIndex]);

  return (
    <section className="py-12">
      <Container>
        <div className="relative flex flex-col items-center space-y-6">
          <div className="w-full max-w-6xl space-y-4 text-right">
            <Heading type={2}>
              Loved by <span className="text-primary">families</span>
            </Heading>
            <SubHeading>
              A few notes from people who care about their loved ones.
            </SubHeading>
          </div>

          <div className="grid w-full max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleTestimonials.map((testimonial, index) => (
              <div
                key={index}
                className={
                  'group flex h-full flex-col space-y-4 rounded-2xl border border-border/60' +
                  ' bg-sidebar p-8 shadow-xl'
                }
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-1 text-primary/80">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <span key={`${testimonial.author}-star-${starIndex}`}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      &ldquo;{testimonial.highlight}&rdquo;
                    </span>
                    {testimonial.content ? ` ${testimonial.content}` : ''}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} · {testimonial.date}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              round
              onClick={() =>
                setPageIndex((current) => Math.max(current - 1, 0))
              }
              disabled={pageIndex === 0}
            >
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {Array.from({ length: pageCount }).map((_, index) => (
                <button
                  key={`testimonial-page-${index}`}
                  type="button"
                  aria-label={`Go to testimonials page ${index + 1}`}
                  onClick={() => setPageIndex(index)}
                  className="flex h-[44px] w-[44px] items-center justify-center"
                >
                  <span
                    className={
                      'h-2.5 w-2.5 rounded-full transition' +
                      (index === pageIndex
                        ? ' bg-primary'
                        : ' bg-border hover:bg-primary/40')
                    }
                  />
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              round
              onClick={() =>
                setPageIndex((current) =>
                  Math.min(current + 1, pageCount - 1),
                )
              }
              disabled={pageIndex === pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
